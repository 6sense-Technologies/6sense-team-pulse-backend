import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import * as mongoose from 'mongoose';
import { GoalAction } from 'src/schemas/GoalAction.schema';
import { Goal } from './entities/goal.entity';
import { GoalsService } from './goals.service';

const mockGoalModel = {
  create: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  skip: jest.fn(),
  limit: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  deleteOne: jest.fn(),
};

const mockGoalActionModel = {
  create: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  skip: jest.fn(),
  limit: jest.fn(),
  findOne: jest.fn(),
};

describe('GoalsService', () => {
  let service: GoalsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        {
          provide: getModelToken(Goal.name),
          useValue: mockGoalModel,
        },
        {
          provide: getModelToken(GoalAction.name),
          useValue: mockGoalActionModel,
        },
      ],
    }).compile();

    service = module.get<GoalsService>(GoalsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a goal', async () => {
      const dto = {
        goal: 'Learn NestJS',
        user: new mongoose.Types.ObjectId().toHexString(),
      };
      const created = { ...dto, _id: new mongoose.Types.ObjectId() };

      mockGoalModel.create.mockResolvedValueOnce(created);

      const result = await service.create(dto);
      expect(mockGoalModel.create).toHaveBeenCalledWith({
        goalItem: dto.goal,
        user: expect.any(mongoose.Types.ObjectId),
      });
      expect(result).toEqual(created);
    });
  });

  describe('findAll', () => {
    it('should return paginated goals', async () => {
      const userId = new mongoose.Types.ObjectId().toHexString();
      const goals = [{ goalItem: 'Test goal', user: userId }];
      mockGoalModel.find.mockReturnValueOnce({
        countDocuments: () => Promise.resolve(1),
      });
      mockGoalModel.countDocuments.mockResolvedValue(1);
      mockGoalModel.find.mockReturnValueOnce({
        skip: () => ({
          limit: () => Promise.resolve(goals),
        }),
      });

      const result = await service.findAll(userId, 1, 10);
      expect(result).toEqual({ count: 1, data: goals });
    });
  });

  describe('findOne', () => {
    it('should find a goal by ID', async () => {
      const id = new mongoose.Types.ObjectId().toHexString();
      const goal = { _id: id, goalItem: 'Test Goal' };

      mockGoalModel.findOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(goal),
      });

      const result = await service.findOne(id);
      expect(result).toEqual(goal);
    });
  });

  describe('update', () => {
    it('should mark goal as Completed', async () => {
      const id = new mongoose.Types.ObjectId().toHexString();
      const updated = { _id: id, status: 'Completed' };

      mockGoalModel.findOneAndUpdate.mockResolvedValueOnce(updated);

      const result = await service.update(id);
      expect(mockGoalModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: id },
        { status: 'Completed' },
        { new: true, upsert: true },
      );
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('should delete goal by ID', async () => {
      const id = new mongoose.Types.ObjectId().toHexString();
      mockGoalModel.deleteOne.mockResolvedValueOnce({ deletedCount: 1 });

      const result = await service.remove(id);
      expect(mockGoalModel.deleteOne).toHaveBeenCalledWith({ _id: id });
      expect(result).toEqual({ deletedCount: 1 });
    });
  });

  describe('createAction', () => {
    it('should create an action and update goal status to In Progress', async () => {
      const dto = {
        action: 'Write tests',
        goal: new mongoose.Types.ObjectId().toHexString(),
      };
      const action = { ...dto, _id: new mongoose.Types.ObjectId() };

      mockGoalModel.findOneAndUpdate.mockResolvedValueOnce({
        status: 'In Progress',
      });
      mockGoalActionModel.create.mockResolvedValueOnce(action);

      const result = await service.createAction(dto);
      expect(result).toEqual(action);
    });
  });

  describe('findAllAction', () => {
    it('should return all actions for a goal', async () => {
      const goalId = new mongoose.Types.ObjectId().toHexString();
      const actions = [{ goal: goalId, action: 'test action' }];

      mockGoalActionModel.find.mockReturnValueOnce({
        countDocuments: () => Promise.resolve(1),
      });
      mockGoalActionModel.countDocuments.mockResolvedValueOnce(1);
      mockGoalActionModel.find.mockReturnValueOnce({
        skip: () => ({
          limit: () => Promise.resolve(actions),
        }),
      });

      const result = await service.findAllAction(goalId);
      expect(result).toEqual({ count: 1, data: actions });
    });
  });

  describe('findOneAction', () => {
    it('should return one action by ID', async () => {
      const id = new mongoose.Types.ObjectId().toHexString();
      const action = { _id: id, action: 'Test Action' };

      mockGoalActionModel.findOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(action),
      });

      const result = await service.findOneAction(id);
      expect(result).toEqual(action);
    });
  });
});
