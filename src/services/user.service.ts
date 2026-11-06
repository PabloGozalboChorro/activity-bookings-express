import { CreateUserRequest, LoginRequest, User, ValidationError } from '../types/user';
import { logger } from '../utils/logger';
import { JsonRepository } from '../repositories/json.repository';

export class UserService {
  private repository: JsonRepository<User>;

  constructor(repository?: JsonRepository<User>) {
    if (repository) {
      this.repository = repository;
    } else {
      // Fallback: own file-backed repository when none is injected
      this.repository = new JsonRepository<User>('db/users.json');
      this.repository.load();
    }
  }

  /**
   * Creates a new user
   * Throws if validation fails or email already exists
   */
  create(req: CreateUserRequest): User {
    const errors = this.validateRegister(req);
    if (errors.length > 0) {
      throw new Error('Validation failed');
    }

    // Check if email already exists
    if (this.getByEmail(req.email)) {
      throw new Error('Email already registered');
    }

    const userId = `user-${this.repository.getNextId()}`;
    const user: User = {
      id: userId,
      username: req.username,
      email: req.email.toLowerCase(),
      password: req.password, // In production, hash this with bcrypt
      terms: req.terms,
      createdAt: new Date().toISOString(),
    };

    this.repository.create(user);
    logger.info('UserService', 'User created', { id: userId, email: user.email });
    return user;
  }

  /**
   * Retrieves a user by ID
   * Returns undefined if not found
   */
  getById(id: string): User | undefined {
    return this.repository.getById(id);
  }

  /**
   * Retrieves a user by email (case-insensitive) from the shared repository
   * Returns undefined if not found
   */
  getByEmail(email: string): User | undefined {
    const normalizedEmail = email.toLowerCase();
    return this.repository.getAll().find((user) => user.email.toLowerCase() === normalizedEmail);
  }

  /**
   * Authenticates a user with email and password
   * Returns user if credentials are valid, throws if invalid
   */
  authenticate(req: LoginRequest): User {
    const errors = this.validateLogin(req);
    if (errors.length > 0) {
      throw new Error('Validation failed');
    }

    const user = this.getByEmail(req.email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // In production, compare hashed password with bcrypt
    if (user.password !== req.password) {
      throw new Error('Invalid email or password');
    }

    logger.info('UserService', 'User authenticated', { id: user.id, email: user.email });
    return user;
  }

  /**
   * Validates registration request
   * Returns array of all validation errors (empty if valid)
   */
  validateRegister(data: unknown): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!data || typeof data !== 'object') {
      return [{ field: 'body', message: 'Request body must be a valid JSON object' }];
    }

    const req = data as Record<string, unknown>;

    // Validate username
    if (!req.username || typeof req.username !== 'string' || req.username.trim() === '') {
      errors.push({ field: 'username', message: 'Username is required and must be a non-empty string' });
    }

    // Validate email
    if (!req.email || typeof req.email !== 'string' || req.email.trim() === '') {
      errors.push({ field: 'email', message: 'Email is required and must be a non-empty string' });
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(req.email)) {
        errors.push({ field: 'email', message: 'Email must be a valid email address' });
      }
    }

    // Validate password
    if (!req.password || typeof req.password !== 'string' || req.password.length < 6) {
      errors.push({ field: 'password', message: 'Password is required and must be at least 6 characters long' });
    }

    // Validate terms
    if (req.terms !== true) {
      errors.push({ field: 'terms', message: 'Terms acceptance is required' });
    }

    return errors;
  }

  /**
   * Validates login request
   * Returns array of all validation errors (empty if valid)
   */
  validateLogin(data: unknown): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!data || typeof data !== 'object') {
      return [{ field: 'body', message: 'Request body must be a valid JSON object' }];
    }

    const req = data as Record<string, unknown>;

    // Validate email
    if (!req.email || typeof req.email !== 'string' || req.email.trim() === '') {
      errors.push({ field: 'email', message: 'Email is required and must be a non-empty string' });
    }

    // Validate password
    if (!req.password || typeof req.password !== 'string' || req.password.trim() === '') {
      errors.push({ field: 'password', message: 'Password is required and must be a non-empty string' });
    }

    return errors;
  }
}
