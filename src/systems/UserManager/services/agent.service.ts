import { hash } from 'bcrypt';
import mongoose from 'mongoose';
import { Agent } from '@systems/UserManager/interfaces/user.interface';
import { CreateAgentDto, UpdateAgentDto, UpdateAgentSelfDto } from '@systems/UserManager/dtos/agent.dto';
import userModel from '@systems/UserManager/models/user.model';
import loungeServiceModel from '@systems/ServiceCatalogSystem/models/loungeService.model';
import { BadRequestException, ConflictException, NotFoundException } from '@exceptions/HttpException';
import { isEmpty } from '@utils/util';
import { logger } from '@utils/logger';
import { BCRYPT_ROUNDS } from '@config/constants';
import R2Service from '@shared/services/cloudflareR2.service';
import QueueService from '@systems/BookingSystem/services/queue.service';

/**
 * AgentService manages the lifecycle of Agent users (User documents with
 * `type === 'agent'`). Agents are created by Admins or Lounges, log in
 * via the standard /v1/auth/login flow, and run their own daily queue.
 */
class AgentService {
  public users = userModel;
  public loungeServices = loungeServiceModel;
  private queueService = new QueueService();

  /** Fields safe to send back to clients (never the password / refreshTokens). */
  private static readonly PUBLIC_FIELDS =
    '-password -refreshTokens -emailVerification -fcmTokens -failedLoginAttempts -lockUntil -oauth -__v';

  // --- Internal helpers --------------------------------------------

  private async findAgent(agentId: string): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      throw new BadRequestException('Invalid agent ID format', 'INVALID_AGENT_ID');
    }
    const agent = await this.users.findOne({ _id: agentId, type: 'agent' });
    if (!agent) throw new NotFoundException('Agent not found', 'AGENT_NOT_FOUND');
    return agent;
  }

  /** Throw if `loungeId` is supplied and the agent does not belong to it. */
  private verifyOwnership(agent: any, loungeId?: string): void {
    if (loungeId && agent.parentLounge?.toString() !== loungeId) {
      throw new NotFoundException('Agent not found', 'AGENT_NOT_FOUND');
    }
  }

  /** Validate that all listed services exist, are active, and belong to the lounge. */
  private async validateServicesForLounge(serviceIds: string[], loungeId: string): Promise<void> {
    const services = await this.loungeServices.find({
      _id: { $in: serviceIds },
      loungeId,
      isActive: true,
      status: 'active',
    });
    if (services.length !== new Set(serviceIds).size) {
      throw new BadRequestException('Some lounge services not found or do not belong to the specified lounge', 'INVALID_LOUNGE_SERVICES');
    }
  }

  // --- CRUD (admin / lounge facing) --------------------------------

  /**
   * Create a new Agent user.
   *
   * Caller contract (enforced by the controller):
   *   - When the caller is a Lounge, `data.parentLounge` is overridden with the
   *     authenticated lounge id.
   *   - When the caller is an Admin, `data.parentLounge` MUST be supplied.
   */
  public async createAgent(data: CreateAgentDto, file?: Express.Multer.File): Promise<Agent> {
    if (isEmpty(data) || !data.email || !data.password || !data.parentLounge || !data.services?.length) {
      throw new BadRequestException('Email, password, parent lounge and services are required', 'MISSING_REQUIRED_FIELDS');
    }

    const normalizedEmail = data.email.toLowerCase().trim();

    // Parent lounge must exist and be a Lounge
    const lounge = await this.users.findOne({ _id: data.parentLounge, type: 'lounge' });
    if (!lounge) throw new NotFoundException('Lounge not found', 'LOUNGE_NOT_FOUND');

    // Email & phone uniqueness across the whole User collection
    if (await this.users.findOne({ email: normalizedEmail })) {
      throw new ConflictException('Email already registered', 'EMAIL_EXISTS');
    }
    if (data.phoneNumber && (await this.users.findOne({ phoneNumber: data.phoneNumber }))) {
      throw new ConflictException('Phone number already registered', 'PHONE_EXISTS');
    }

    await this.validateServicesForLounge(data.services, data.parentLounge);

    const hashedPassword = await hash(data.password, BCRYPT_ROUNDS);

    const created = await this.users.create({
      email: normalizedEmail,
      password: hashedPassword,
      type: 'agent',
      agentName: data.agentName,
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber,
      parentLounge: data.parentLounge,
      services: data.services,
      acceptQueueBooking: data.acceptQueueBooking ?? false,
      isBlocked: data.isBlocked ?? false,
      // Agents are created by trusted parties; mark email already verified so
      // they can log in immediately without needing the magic-link flow.
      emailVerification: [{ isVerified: true }],
    });

    // Optional avatar upload (file or base64 string)
    if (file || data.profileImage) {
      try {
        const buffer = file ? file.buffer : Buffer.from(data.profileImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const { url, publicId } = await R2Service.uploadProfileImage(buffer, created._id.toString());
        await this.users.findByIdAndUpdate(created._id, { profileImage: { url, publicId } });
      } catch (err) {
        logger.warn(`AgentService.createAgent: avatar upload failed for ${created._id}: ${err.message}`);
      }
    }

    // Auto-create today's queue so the agent can immediately receive bookings
    try {
      await this.queueService.createQueue(created._id.toString());
    } catch (err) {
      logger.warn(`AgentService.createAgent: queue auto-creation failed for ${created._id}: ${err.message}`);
    }

    logger.info(`AgentService.createAgent: agent created ${created._id} for lounge ${data.parentLounge}`);
    return this.getAgentById(created._id.toString());
  }

  /** Get all agents belonging to a lounge. */
  public async getAgentsByLounge(loungeId: string): Promise<Agent[]> {
    if (isEmpty(loungeId)) throw new BadRequestException('Lounge ID is required', 'MISSING_LOUNGE_ID');
    return this.users
      .find({ type: 'agent', parentLounge: loungeId })
      .select(AgentService.PUBLIC_FIELDS)
      .populate('parentLounge', 'loungeTitle email')
      .populate('services', 'serviceId price duration');
  }

  /** Get a single agent by id, optionally enforcing lounge ownership. */
  public async getAgentById(agentId: string, loungeId?: string): Promise<Agent> {
    const agent = await this.findAgent(agentId);
    this.verifyOwnership(agent, loungeId);
    return this.users
      .findById(agent._id)
      .select(AgentService.PUBLIC_FIELDS)
      .populate('parentLounge', 'loungeTitle email')
      .populate('services', 'serviceId price duration');
  }

  /** Update an agent (admin or owning lounge). */
  public async updateAgent(agentId: string, data: UpdateAgentDto, loungeId?: string): Promise<Agent> {
    if (isEmpty(data)) throw new BadRequestException('Update data is required', 'MISSING_UPDATE_DATA');
    const agent = await this.findAgent(agentId);
    this.verifyOwnership(agent, loungeId);

    const update: any = {};
    if (data.agentName !== undefined) update.agentName = data.agentName;
    if (data.firstName !== undefined) update.firstName = data.firstName;
    if (data.lastName !== undefined) update.lastName = data.lastName;
    if (data.phoneNumber !== undefined) {
      if (data.phoneNumber !== agent.phoneNumber) {
        const dup = await this.users.findOne({ phoneNumber: data.phoneNumber, _id: { $ne: agent._id } });
        if (dup) throw new ConflictException('Phone number already registered', 'PHONE_EXISTS');
      }
      update.phoneNumber = data.phoneNumber;
    }
    if (data.password !== undefined) {
      update.password = await hash(data.password, BCRYPT_ROUNDS);
      update.passwordChangedAt = new Date();
    }
    if (data.isBlocked !== undefined) update.isBlocked = data.isBlocked;
    if (data.acceptQueueBooking !== undefined) update.acceptQueueBooking = data.acceptQueueBooking;
    if (data.services !== undefined) {
      await this.validateServicesForLounge(data.services, agent.parentLounge.toString());
      update.services = data.services;
    }

    await this.users.findByIdAndUpdate(agent._id, update, { runValidators: true });
    logger.info(`AgentService.updateAgent: ${agentId} updated`);
    return this.getAgentById(agentId);
  }

  /** Delete an agent (admin or owning lounge). */
  public async deleteAgent(agentId: string, loungeId?: string): Promise<void> {
    const agent = await this.findAgent(agentId);
    this.verifyOwnership(agent, loungeId);
    await this.users.findByIdAndDelete(agent._id);
    logger.info(`AgentService.deleteAgent: ${agentId} deleted`);
  }

  /**
   * Get all agents visible to the caller.
   *   - admin ? every agent
   *   - lounge ? agents bound to that lounge
   *   - any other role (e.g. client) ? all agents (read-only listing)
   */
  public async getAllAgents(user?: any): Promise<Agent[]> {
    const query: any = { type: 'agent' };
    if (user?.type === 'lounge') query.parentLounge = user._id;
    return this.users
      .find(query)
      .select(AgentService.PUBLIC_FIELDS)
      .populate('parentLounge', 'loungeTitle email')
      .populate('services', 'serviceId price duration');
  }

  /** Replace an agent's profile image. */
  public async uploadProfileImage(agentId: string, file: Express.Multer.File, loungeId?: string): Promise<Agent> {
    if (!file) throw new BadRequestException('Image file is required', 'MISSING_FILE');
    const agent = await this.findAgent(agentId);
    this.verifyOwnership(agent, loungeId);

    if (agent.profileImage?.publicId) {
      try {
        await R2Service.deleteImage(agent.profileImage.publicId);
      } catch (err) {
        logger.warn(`AgentService.uploadProfileImage: old image delete failed for ${agentId}: ${err.message}`);
      }
    }
    const { url, publicId } = await R2Service.uploadProfileImage(file.buffer, agentId);
    await this.users.findByIdAndUpdate(agent._id, { profileImage: { url, publicId } });
    return this.getAgentById(agentId);
  }

  // --- Self-service (the authenticated agent acting on themselves) -

  /** Get the authenticated agent's own profile. */
  public async getOwnProfile(agentId: string): Promise<Agent> {
    return this.getAgentById(agentId);
  }

  /** Update the authenticated agent's own editable profile fields. */
  public async updateOwnProfile(agentId: string, data: UpdateAgentSelfDto): Promise<Agent> {
    if (isEmpty(data)) throw new BadRequestException('Update data is required', 'MISSING_UPDATE_DATA');
    const agent = await this.findAgent(agentId);
    const update: any = {};
    if (data.agentName !== undefined) update.agentName = data.agentName;
    if (data.firstName !== undefined) update.firstName = data.firstName;
    if (data.lastName !== undefined) update.lastName = data.lastName;
    if (data.bio !== undefined) update.bio = data.bio;
    if (data.phoneNumber !== undefined && data.phoneNumber !== agent.phoneNumber) {
      const dup = await this.users.findOne({ phoneNumber: data.phoneNumber, _id: { $ne: agent._id } });
      if (dup) throw new ConflictException('Phone number already registered', 'PHONE_EXISTS');
      update.phoneNumber = data.phoneNumber;
    }
    await this.users.findByIdAndUpdate(agent._id, update, { runValidators: true });
    return this.getAgentById(agentId);
  }

  /** Toggle the `acceptQueueBooking` availability flag from the agent's perspective. */
  public async setOwnAvailability(agentId: string, accept: boolean): Promise<Agent> {
    const agent = await this.findAgent(agentId);
    agent.acceptQueueBooking = accept;
    await agent.save();
    logger.info(`AgentService.setOwnAvailability: agent ${agentId} acceptQueueBooking=${accept}`);
    return this.getAgentById(agentId);
  }

  /** Replace the authenticated agent's own profile image. */
  public async uploadOwnProfileImage(agentId: string, file: Express.Multer.File): Promise<Agent> {
    return this.uploadProfileImage(agentId, file);
  }
}


export default AgentService;

