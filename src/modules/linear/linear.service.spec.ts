import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { IssueEntry } from '../../schemas/IssueEntry.schema';
import { ToolService } from '../tool/tool.service';
import { LinearService } from './linear.service';

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

  describe('linearToolValidation', () => {
    it('should throw BadRequestException if toolId is invalid', async () => {
      await expect(service.linearToolValidation('')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if tool is not found', async () => {
      mockToolService.getToolById.mockResolvedValue(null);
      await expect(service.linearToolValidation('toolId')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if tool is not Linear', async () => {
      mockToolService.getToolById.mockResolvedValue({ toolName: 'NotLinear' });
      await expect(service.linearToolValidation('toolId')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if tool is already connected', async () => {
      mockToolService.getToolById.mockResolvedValue({
        toolName: 'Linear',
        accessToken: 'existingToken',
      });
      await expect(service.linearToolValidation('toolId')).rejects.toThrow(BadRequestException);
    });

    it('should return the tool if valid', async () => {
      mockToolService.getToolById.mockResolvedValue({ toolName: 'Linear', accessToken: null });
      const result = await service.linearToolValidation('toolId');
      expect(result).toEqual({ toolName: 'Linear', accessToken: null });
    });
  });

  describe('connect', () => {
    it('should generate the correct URL for Linear OAuth', async () => {
      mockToolService.getToolById.mockResolvedValue({ toolName: 'Linear', accessToken: null });
      mockConfigService.getOrThrow.mockReturnValue('client_id');

      const url = await service.connect('toolId', 'http://localhost');
      expect(url).toContain('https://linear.app/oauth/authorize');
      expect(url).toContain('client_id=client_id');
      expect(url).toContain('redirect_uri=http://localhost/linear/callback');
    });

    it('should throw BadRequestException if tool is not Linear', async () => {
      mockToolService.getToolById.mockResolvedValue({ toolName: 'NotLinear' });
      await expect(service.connect('toolId', 'http://localhost')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('handleCallback', () => {
//     it('should throw BadRequestException if code is empty', async () => {
//       await expect(service.handleCallback('', 'toolId', 'http://localhost')).rejects.toThrow(
//         BadRequestException,
    it('should throw UnauthorizedException if access_token is missing', async () => {
      mockToolService.getToolById.mockResolvedValue({ toolName: 'Linear', accessToken: null });
      mockConfigService.getOrThrow.mockReturnValue('client_id');

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await expect(service.handleCallback('code', 'toolId', 'http://localhost')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token exchange fails', async () => {
      mockToolService.getToolById.mockResolvedValue({ toolName: 'Linear', accessToken: null });
      mockConfigService.getOrThrow.mockReturnValue('client_id');

      // Simulating a failed fetch (Unauthorized - Invalid code)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid code' }),
      });

      await expect(service.handleCallback('code', 'toolId', 'http://localhost')).rejects.toThrow(
        UnauthorizedException,
      );
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

    it('should throw UnauthorizedException if there is no access token', async () => {
      mockToolService.getToolById.mockResolvedValue({ toolName: 'Linear', accessToken: null });
      mockConfigService.getOrThrow.mockReturnValue('client_id');

      // Simulating a successful fetch (Token exchange)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: null }),
      });

      await expect(service.handleCallback('code', 'toolId', 'http://localhost')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      mockToolService.getToolById.mockResolvedValue({ toolName: 'Linear', accessToken: null });
      mockConfigService.getOrThrow.mockReturnValue('client_id');

      // Simulating a network error
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

      await expect(service.handleCallback('code', 'toolId', 'http://localhost')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('fetchAndSaveIssuesFromLinear', () => {
    // it('should fetch and save issues for multiple tools', async () => {
    //   const mockTool = { accessToken: 'validToken', users: [{ emailAddress: 'user@example.com', _id: 'userId' }] };
    //   mockToolService.getLinearToolsWithUsers.mockResolvedValue([mockTool]);

    //   const mockResponse = {
    //     data: {
    //       issues: {
    //         nodes: [
    //           {
    //             id: 'issueId',
    //             title: 'Issue 1',
    //             assignee: { name: 'John Doe' },
    //             dueDate: '2023-07-07',
    //             state: { type: 'notStarted' },
    //             labels: { nodes: [] }
    //           },
    //         ],
    //       },
    //       organization: { urlKey: 'orgUrl' },
    //     },
    //   };

    //   // Mocking the fetch method to return the mock response
    //   (global.fetch as jest.Mock).mockResolvedValueOnce({
    //     ok: true,
    //     json: async () => mockResponse,
    //   });

    //   // Call the function to be tested
    //   await service.fetchAndSaveIssuesFromLinear('2023-07-07');

    //   // Ensure that bulkWrite was called
    //   expect(mockIssueEntryModel.bulkWrite).toHaveBeenCalledTimes(1);
    //   expect(mockIssueEntryModel.bulkWrite).toHaveBeenCalledWith(expect.anything());
    // });

    it('should handle failed fetches gracefully', async () => {
      const mockTool = {
        accessToken: 'validToken',
        users: [{ emailAddress: 'user@example.com', _id: 'userId' }],
      };
      mockToolService.getLinearToolsWithUsers.mockResolvedValue([mockTool]);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Rate limit exceeded' }),
      });

      const result = await service.fetchAndSaveIssuesFromLinear('2023-07-07');

      expect(result.message).toContain('failed');
    });
  });

  describe('buildBulkUpdateOps', () => {
    it('should build bulk update operations from issues', async () => {
      const issues = [
        {
          id: 'issueId',
          title: 'Test Issue',
          assignee: { name: 'John Doe', timezone: 'UTC' },
          state: { type: 'notStarted' },
          labels: { nodes: [] },
          relations: { nodes: [] }, // Ensure 'relations' is defined
          children: { nodes: [] }, // Ensure 'children' is defined
          parent: null,
          dueDate: '2023-07-07',
          createdAt: '2023-07-06',
          identifier: 'issueCode',
          url: 'https://linear.app/issue/issueCode',
        },
      ];

      const userId = new Types.ObjectId();
      const organizationId = new Types.ObjectId();
      const orgUrlKey = 'orgKey';

      const bulkOps = await service.buildBulkUpdateOps(issues, userId, organizationId, orgUrlKey);

      expect(bulkOps.length).toBe(1);
      expect(bulkOps[0].updateOne.filter.issueId).toBe('issueId');
    });
  });

  describe('checkPlanned', () => {
    it('should return true if created day is before due day and created time is before 11:00 AM', () => {
      const result = service.checkPlanned('2023-07-06T09:00:00', '2023-07-07', 'UTC');
      expect(result).toBe(true);
    });

    // it('should return false if created time is after 11:00 AM', () => {
    //   const result = service.checkPlanned('2023-07-07T12:00:00', '2023-07-07', 'UTC');
    //   expect(result).toBe(false);
    // });

    it('should return false if created day is after due day', () => {
      const result = service.checkPlanned('2023-07-08T09:00:00', '2023-07-07', 'UTC');
      expect(result).toBe(false);
    });
  });

  describe('computeIssueStatus', () => {
    it('should return "notStarted" if stateType is not defined', () => {
      const result = service.computeIssueStatus('', null, null);
      expect(result).toBe('notStarted');
    });

    it('should return "completed" if state is completed and completedAt is before dueDate', () => {
      const result = service.computeIssueStatus('completed', '2023-07-06T09:00:00', '2023-07-07');
      expect(result).toBe('completed');
    });

    it('should return "lateCompleted" if state is completed and completedAt is after dueDate', () => {
      const result = service.computeIssueStatus('completed', '2023-07-08T09:00:00', '2023-07-07');
      expect(result).toBe('lateCompleted');
    });

    it('should return "completed" if state is completed and completedAt is after dueDate', () => {
      const result = service.computeIssueStatus('completed', null, null);
      expect(result).toBe('completed');
    });
  });
});
