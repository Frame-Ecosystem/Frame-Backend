/**
 * JWT helpers for the Frame Beauty backend test suite.
 * Generates signed access tokens for different user types.
 *
 * Uses process.env.SECRET_KEY which is set to 'test-jwt-secret-key-for-jest-only'
 * by src/__mocks__/jest.setup.js before any test runs.
 */
import jwt from 'jsonwebtoken';
import { testIds } from './factories';

const secret = () => process.env.SECRET_KEY as string;

/** Generate an access token for a client user */
export const clientToken = () => jwt.sign({ _id: testIds.client }, secret(), { expiresIn: '1h' });

/** Generate an access token for a lounge user */
export const loungeToken = () => jwt.sign({ _id: testIds.lounge }, secret(), { expiresIn: '1h' });

/** Generate an access token for an admin user */
export const adminToken = () => jwt.sign({ _id: testIds.admin }, secret(), { expiresIn: '1h' });

/** Generate an access token for any custom payload */
export const makeToken = (payload: Record<string, unknown>) => jwt.sign(payload, secret(), { expiresIn: '1h' });

/** Authorization header value for supertest */
export const bearerHeader = (token: string) => `Bearer ${token}`;
