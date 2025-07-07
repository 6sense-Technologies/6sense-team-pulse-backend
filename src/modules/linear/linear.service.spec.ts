import { Test, TestingModule } from '@nestjs/testing';
import { LinearService } from './linear.service';
import { ToolService } from '../tool/tool.service';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { IssueEntry } from '../../schemas/IssueEntry.schema';
import { NotFoundException, BadRequestException, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { Types } from 'mongoose';

// Mock models and services
const mockToolService = {
  getLinearToolsWithUsers: jest.fn(),
  getToolById: jest.fn(),
  updateToolWithAccessToken: jest.fn(),
  removeAccessToken: jest.fn(),
};

const mockConfigService = {
  getOrThrow: jest.fn(),
};

const mockIssueEntryModel = {
  bulkWrite: jest.fn(),
};

describe('LinearService', () => {
  let service: LinearService;
  let toolService: ToolService;
  let configService: ConfigService;
  let issueEntryModel;

  // Mock the global fetch method
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinearService,
        { provide: ToolService, useValue: mockToolService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getModelToken(IssueEntry.name), useValue: mockIssueEntryModel },
      ],
    }).compile();

    service = module.get<LinearService>(LinearService);
    toolService = module.get<ToolService>(ToolService);
    configService = module.get<ConfigService>(ConfigService);
    issueEntryModel = module.get(getModelToken(IssueEntry.name));
  });

  describe('handleCallback', () => {
    it('should throw UnauthorizedException if token exchange fails', async () => {
      mockToolService.getToolById.mockResolvedValue({ toolName: 'Linear', accessToken: null });
      mockConfigService.getOrThrow.mockReturnValue('client_id');

      // Simulating a failed fetch (Unauthorized - Invalid code)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid code' }),
      });

      await expect(service.handleCallback('code', 'toolId', 'http://localhost')).rejects.toThrow(UnauthorizedException);
    });

    it('should call updateToolWithAccessToken on successful token exchange', async () => {
      mockToolService.getToolById.mockResolvedValue({ toolName: 'Linear', accessToken: null });
      mockConfigService.getOrThrow.mockReturnValue('client_id');

      // Simulating a successful fetch (Token exchange)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token' }),
      });

      await service.handleCallback('code', 'toolId', 'http://localhost');
      expect(mockToolService.updateToolWithAccessToken).toHaveBeenCalledWith('toolId', 'token');
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      mockToolService.getToolById.mockResolvedValue({ toolName: 'Linear', accessToken: null });
      mockConfigService.getOrThrow.mockReturnValue('client_id');

      // Simulating a network error
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

      await expect(service.handleCallback('code', 'toolId', 'http://localhost')).rejects.toThrow(InternalServerErrorException);
    });
  });
});
