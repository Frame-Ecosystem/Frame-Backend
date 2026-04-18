import { NextFunction, Request, Response } from 'express';
import { RequestWithUser } from '@interfaces/auth/auth.interface';
import { ServiceCategory } from '@interfaces/catalog/serviceCategory.interface';
import { CreateServiceDto, UpdateServiceDto } from '@dtos/catalog/services.dto';
import { CreateServiceCategoryDto, UpdateServiceCategoryDto } from '@dtos/catalog/serviceCategories.dto';
import ServicesService from '@services/catalog/services.service';
import ServiceCategoriesService from '@services/catalog/serviceCategories.service';
import ServiceSuggestionsService from '@services/catalog/serviceSuggestions.service';
import LoungeServicesAdminService from '@services/admin/loungeServices.service';
import QueueService from '@services/queue/queue.service';
import { stripSensitiveFields } from '@utils/util';

class CatalogManagementController {
  private servicesService = new ServicesService();
  private categoriesService = new ServiceCategoriesService();
  private suggestionsService = new ServiceSuggestionsService();
  private loungeServicesAdmin = new LoungeServicesAdminService();
  private queueService = new QueueService();

  // ─── Services CRUD ────────────────────────────────────────────

  public getServicesPaginated = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const { services, total } = await this.servicesService.getServicesPaginated(page, limit);
      res.status(200).json({
        data: services,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        message: 'Services retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  public searchServices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query.q as string;
      const services = await this.servicesService.searchServices(query);
      res.status(200).json({ data: services, message: 'Services found' });
    } catch (error) {
      next(error);
    }
  };

  public getServicesByCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryId } = req.params;
      const services = await this.servicesService.getServicesByCategory(categoryId);
      res.status(200).json({ data: services, message: 'Services by category retrieved' });
    } catch (error) {
      next(error);
    }
  };

  public getServiceById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { serviceId } = req.params;
      const service = await this.servicesService.getServiceById(serviceId);
      res.status(200).json({ data: service, message: 'Service retrieved' });
    } catch (error) {
      next(error);
    }
  };

  public createService = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data: CreateServiceDto = req.body;
      const service = await this.servicesService.createService(data);
      res.status(201).json({ data: service, message: 'Service created successfully' });
    } catch (error) {
      next(error);
    }
  };

  public bulkCreateServices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data: CreateServiceDto[] = req.body;
      const services = await this.servicesService.bulkCreateServices(data);
      res.status(201).json({ data: services, count: services.length, message: 'Services created successfully' });
    } catch (error) {
      next(error);
    }
  };

  public updateService = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { serviceId } = req.params;
      const data: UpdateServiceDto = req.body;
      const service = await this.servicesService.updateService(serviceId, data);
      res.status(200).json({ data: service, message: 'Service updated successfully' });
    } catch (error) {
      next(error);
    }
  };

  public deleteService = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { serviceId } = req.params;
      const service = await this.servicesService.deleteService(serviceId);
      res.status(200).json({ data: service, message: 'Service deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  // ─── Service Categories CRUD ──────────────────────────────────

  public getAllServiceCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categories = await this.categoriesService.getAllServiceCategories();
      res.status(200).json({ data: categories, message: 'Service categories retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  public searchServiceCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query.q as string;
      const categories = await this.categoriesService.searchServiceCategories(query);
      res.status(200).json({ data: categories, message: 'Service categories found' });
    } catch (error) {
      next(error);
    }
  };

  public getServiceCategoryById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categoryId: string = req.params.categoryId;
      const category = await this.categoriesService.getServiceCategoryById(categoryId);
      res.status(200).json({ data: category, message: 'Service category retrieved' });
    } catch (error) {
      next(error);
    }
  };

  public createServiceCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categoryData: CreateServiceCategoryDto = req.body;
      const newCategory: ServiceCategory = await this.categoriesService.createServiceCategory(categoryData);
      res.status(201).json({ data: newCategory, message: 'Service category created successfully' });
    } catch (error) {
      next(error);
    }
  };

  public updateServiceCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categoryId: string = req.params.categoryId;
      const categoryData: UpdateServiceCategoryDto = req.body;
      const updatedCategory: ServiceCategory = await this.categoriesService.updateServiceCategory(categoryId, categoryData);
      res.status(200).json({ data: updatedCategory, message: 'Service category updated successfully' });
    } catch (error) {
      next(error);
    }
  };

  public deleteServiceCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categoryId: string = req.params.categoryId;
      const deletedCategory: ServiceCategory = await this.categoriesService.deleteServiceCategory(categoryId);
      res.status(200).json({ data: deletedCategory, message: 'Service category deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  // ─── Service Suggestions (Admin Operations) ───────────────────

  public getServiceSuggestionsStats = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const stats = await this.suggestionsService.getServiceSuggestionsStats();
      res.status(200).json({ data: stats, message: 'Service suggestions statistics retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  public updateServiceSuggestionStatus = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const suggestionId = req.params.suggestionId;
      const statusData = req.body;
      const result = await this.suggestionsService.updateServiceSuggestionStatus(suggestionId, statusData);
      res.status(200).json(this.formatSuggestionStatusResponse(result));
    } catch (error) {
      next(error);
    }
  };

  public adminUpdateServiceSuggestionStatus = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const suggestionId = req.params.suggestionId;
      const updateData = req.body;
      const result = await this.suggestionsService.adminUpdateServiceSuggestionStatus(suggestionId, updateData);
      res.status(200).json(this.formatSuggestionStatusResponse(result));
    } catch (error) {
      next(error);
    }
  };

  // ─── Lounge Services (Admin Operations) ───────────────────────

  public getLoungeServicesPaginated = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const { services, total } = await this.loungeServicesAdmin.getLoungeServicesPaginated(page, limit);
      res.status(200).json({
        data: services,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        message: 'Lounge services retrieved',
      });
    } catch (error) {
      next(error);
    }
  };

  public bulkCreateLoungeServices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      const services = await this.loungeServicesAdmin.bulkCreateLoungeServices(data);
      res.status(201).json({ data: services, count: services.length, message: 'Lounge services created successfully' });
    } catch (error) {
      next(error);
    }
  };

  public searchLoungeServices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query.q as string;
      const services = await this.loungeServicesAdmin.searchLoungeServices(query);
      res.status(200).json({ data: services, count: services.length, message: 'Lounge services found' });
    } catch (error) {
      next(error);
    }
  };

  // ─── Queue Management ────────────────────────────────────────

  public populateDailyQueues = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.queueService.populateDailyQueues();
      res.status(200).json({ data: result, message: `Daily queues populated: ${result.processed} bookings processed` });
    } catch (error) {
      next(error);
    }
  };

  // ─── Private Helpers ──────────────────────────────────────────

  private formatSuggestionStatusResponse(result: any) {
    return {
      data: {
        suggestion: stripSensitiveFields(result.suggestion),
        service: result.service ? stripSensitiveFields(result.service) : null,
        loungeService: result.loungeService ? stripSensitiveFields(result.loungeService) : null,
      },
      message: result.service ? 'Service suggestion approved and implemented successfully' : 'Service suggestion status updated successfully',
    };
  }
}

export default CatalogManagementController;
