import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { GoalAction } from '../../schemas/GoalAction.schema';
import { CreateGoalActionDto } from './dto/create-goal-action.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { Goal } from './entities/goal.entity';

@Injectable()
export class GoalsService {
  constructor(
    @InjectModel(Goal.name) private readonly goalModel: Model<Goal>,
    @InjectModel(GoalAction.name)
    private readonly goalActionModel: Model<GoalAction>,
  ) {}

  async create(createGoalDto: CreateGoalDto) {
    return await this.goalModel.create({
      goalItem: createGoalDto.goal,
      user: new mongoose.Types.ObjectId(createGoalDto.user),
    });
  }

  async findAll(userId: string, page: number = 1, limit: number = 10) {
    const count = await this.goalModel.find({ user: userId }).countDocuments();

    const datas = await this.goalModel
      .find({ user: userId })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));
    return {
      count: count,
      data: datas,
    };
  }

  findOne(id: string) {
    return this.goalModel.findOne({ _id: id }).populate('user');
  }

  async update(id: string) {
    let data = {};
    data['status'] = 'Completed';
    return await this.goalModel.findOneAndUpdate({ _id: id }, data, {
      new: true,
      upsert: true,
      // // Return additional properties about the operation, not just the document
      // includeResultMetadata: true,
    });
  }

  remove(id: string) {
    return this.goalModel.deleteOne({ _id: id });
  }

  async createAction(createGoalActionDto: CreateGoalActionDto) {
    await this.goalModel.findOneAndUpdate(
      { _id: createGoalActionDto.goal },
      { status: 'In Progress' },
    );
    return await this.goalActionModel.create({
      action: createGoalActionDto.action,
      goal: new mongoose.Types.ObjectId(createGoalActionDto.goal),
    });
  }

  async findAllAction(id: string, page: number = 1, limit: number = 10) {
    const counts = await this.goalActionModel.find({ goal: id }).countDocuments();
    const datas = await this.goalActionModel
      .find({ goal: id })
      .skip((page - 1) * limit)
      .limit(limit);
    return {
      count: counts,
      data: datas,
    };
  }

  findOneAction(id: string) {
    return this.goalActionModel.findOne({ _id: id }).populate('goal');
  }
}
