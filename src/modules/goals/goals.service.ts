import { Injectable } from '@nestjs/common';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { Goal } from './entities/goal.entity';
import mongoose, { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { CreateGoalActionDto } from './dto/create-goal-action.dto';
import { GoalAction } from '../users/schemas/GoalAction.schema';

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

  findAll(userId: string, page: number = 1, limit: number = 10) {
    return this.goalModel
      .find({ user: userId })
      .skip((page - 1) * limit)
      .limit(limit);
  }

  findOne(id: string) {
    return this.goalModel.findOne({ _id: id }).populate('user');
  }

  async update(id: string, updateGoalDto: UpdateGoalDto) {
    let data = {};
    data['status'] = updateGoalDto.status;
    if (updateGoalDto.goal) data['goalItem'] = updateGoalDto.goal;
    return await this.goalModel.findOneAndUpdate({ _id: id }, data);
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

  findAllAction(id: string, page: number = 1, limit: number = 10) {
    return this.goalActionModel
      .find({ goal: id })
      .skip((page - 1) * limit)
      .limit(limit);
  }

  findOneAction(id: string) {
    return this.goalActionModel.findOne({ _id: id }).populate('goal');
  }
}
