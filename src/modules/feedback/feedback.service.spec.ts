import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import { Feedback } from 'src/schemas/feedback.entity';
import { IssueEntry } from 'src/schemas/IssueEntry.schema';
import { OrganizationService } from '../organization/organization.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackTone } from './enums/feedbackTone.enum';
import { FeedbackType } from './enums/feedbackType.enum';
import { FeedbackService } from './feedback.service';

describe('FeedbackService', () => {
  let service: FeedbackService;
  let feedbackModel: Model<Feedback>;
  let issueEntryModel: Model<IssueEntry>;
  let organizationService: OrganizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackService,
        {
          provide: getModelToken(Feedback.name),
          useValue: {
            create: jest.fn(),
            find: jest.fn(),
            aggregate: jest.fn(),
          },
        },
        {
          provide: getModelToken(IssueEntry.name),
          useValue: {
            find: jest.fn(),
            aggregate: jest.fn(),
          },
        },
        {
          provide: OrganizationService,
          useValue: {
            validateOrgAccess: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FeedbackService>(FeedbackService);
    feedbackModel = module.get<Model<Feedback>>(getModelToken(Feedback.name));
    issueEntryModel = module.get<Model<IssueEntry>>(getModelToken(IssueEntry.name));
    organizationService = module.get<OrganizationService>(OrganizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw an error if the organization is not found', async () => {
      jest.spyOn(organizationService, 'validateOrgAccess').mockResolvedValue(null);

      await expect(
        service.create(
          {
            type: FeedbackType.USER_STORY,
            tone: FeedbackTone.POSITIVE,
            comment: 'Test comment',
            assignedTo: '670f5cb7fcec534287bf881a',
            linkedIssues: [],
          },
          {
            user: {
              userId: '123',
              organizationId: '123',
            },
          } as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw an error if the issues are not found', async () => {
      jest
        .spyOn(organizationService, 'validateOrgAccess')
        .mockResolvedValue({ _id: new Types.ObjectId('670f5cb7fcec534287bf881a') } as any);

      jest.spyOn(issueEntryModel, 'aggregate').mockResolvedValue([]);

      await expect(
        service.create(
          {
            type: FeedbackType.USER_STORY,
            tone: FeedbackTone.POSITIVE,
            comment: 'Test comment',
            assignedTo: '670f5cb7fcec534287bf881a',
            linkedIssues: ['670f5cb7fcec534287bf881a'],
          },
          {
            user: {
              userId: '123',
              organizationId: '123',
            },
          } as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create a feedback', async () => {
      jest
        .spyOn(organizationService, 'validateOrgAccess')
        .mockResolvedValue({ _id: new Types.ObjectId('670f5cb7fcec534287bf881a') } as any);

      jest
        .spyOn(issueEntryModel, 'aggregate')
        .mockResolvedValue([{ _id: new Types.ObjectId('670f5cb7fcec534287bf881a') } as any]);

      const feedbackDto = {
        organizationId: '123',
        type: FeedbackType.USER_STORY,
        linkedIssues: [new Types.ObjectId('670f5cb7fcec534287bf881a')],
        tone: FeedbackTone.POSITIVE,
        comment: 'Test comment',
      };

      jest.spyOn(feedbackModel, 'create').mockResolvedValue(feedbackDto as any);

      const feedback = await service.create(
        feedbackDto as any as CreateFeedbackDto,
        {
          user: {
            userId: '123',
            organizationId: '123',
          },
        } as any,
      );

      expect(feedback).toEqual(feedbackDto);
    });
  });

  describe('findAll', () => {
    it('should find all feedback and return paginated result', async () => {
      const user = {
        userId: '670f5cb7fcec534287bf881a',
        organizationId: '670f5cb7fcec534287bf881a',
        email: 'test@example.com',
      };
      const query = {
        page: 1,
        limit: 10,
        sortOrder: 'desc',
      } as any;
      const metadata = { timezoneRegion: 'Asia/Dhaka' } as any;

      const mockResult = [
        {
          data: [{ _id: new Types.ObjectId('670f5cb7fcec534287bf881a'), comment: 'Test' }],
          count: 1,
        },
      ];

      jest.spyOn(feedbackModel, 'aggregate').mockResolvedValueOnce(mockResult);

      const result = await service.findAll(user, query, metadata);

      expect(result).toEqual({
        data: [{ _id: expect.any(Types.ObjectId), comment: 'Test' }],
        paginationMetadata: {
          page: 1,
          limit: 10,
          totalCount: 1,
          totalPages: 1,
        },
      });
      expect(feedbackModel.aggregate).toHaveBeenCalled();
    });

    it('should return empty data and correct pagination if no feedback found', async () => {
      const user = {
        userId: '670f5cb7fcec534287bf881a',
        organizationId: '670f5cb7fcec534287bf881a',
        email: 'test@example.com',
      };
      const query = {
        page: 2,
        limit: 5,
        sortOrder: 'asc',
      } as any;
      const metadata = { timezoneRegion: 'Asia/Dhaka' } as any;

      jest.spyOn(feedbackModel, 'aggregate').mockResolvedValueOnce([{ data: [], count: 0 }]);

      const result = await service.findAll(user, query, metadata);

      expect(result).toEqual({
        data: [],
        paginationMetadata: {
          page: 2,
          limit: 5,
          totalCount: 0,
          totalPages: 0,
        },
      });
    });

    it('should handle missing count in aggregation result gracefully', async () => {
      const user = {
        userId: '670f5cb7fcec534287bf881a',
        organizationId: '670f5cb7fcec534287bf881a',
        email: 'test@example.com',
      };
      const query = {
        page: 1,
        limit: 10,
        sortOrder: 'desc',
      } as any;
      const metadata = { timezoneRegion: 'Asia/Dhaka' } as any;

      jest.spyOn(feedbackModel, 'aggregate').mockResolvedValueOnce([{}]);

      const result = await service.findAll(user, query, metadata);

      expect(result).toEqual({
        data: [],
        paginationMetadata: {
          page: 1,
          limit: 10,
          totalCount: 0,
          totalPages: 0,
        },
      });
    });

    it('should parse page and limit as numbers and fallback to defaults', async () => {
      const user = {
        userId: '670f5cb7fcec534287bf881a',
        organizationId: '670f5cb7fcec534287bf881a',
        email: 'test@example.com',
      };
      const query = {
        sortOrder: 'desc',
      } as any;
      const metadata = { timezoneRegion: 'Asia/Dhaka' } as any;

      jest.spyOn(feedbackModel, 'aggregate').mockResolvedValueOnce([{ data: [], count: 0 }]);

      const result = await service.findAll(user, query, metadata);

      expect(result.paginationMetadata.page).toBe(1);
      expect(result.paginationMetadata.limit).toBe(10);
    });
  });
  //     });
  //       const user = {
  //         userId: '670f5cb7fcec534287bf881a',
  //         organizationId: '670f5cb7fcec534287bf881a',
  //         email: 'test@example.com',
  //       };
  //       const req = {
  //         query: {
  //           page: 1,
  //           limit: 10,
  //           sort: 'createdAt',
  //           order: 'desc',
  //           search: 'abc',
  //           filter: 'us,Bug',
  //           startDate: '2025-01-01',
  //           endDate: '2025-01-01',
  //         },
  //       } as any;

  //       jest
  //         .spyOn(feedbackModel, 'aggregate')
  //         .mockResolvedValueOnce([
  //           { data: [{ _id: new Types.ObjectId('670f5cb7fcec534287bf881a') }], count: 1 },
  //         ]);

  //       const feedback = await service.findAll(user, req, { timezoneRegion: 'Asia/Dhaka' } as any);

  //       expect(feedback).toEqual({
  //         data: [{ _id: new Types.ObjectId('670f5cb7fcec534287bf881a') }],
  //         count: 1,
  //       });
  //     });
  // });
});
