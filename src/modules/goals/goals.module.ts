import { Module } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { GoalsController } from './goals.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Goal } from './entities/goal.entity';
import { GoalSchema } from '../users/schemas/Goal.schema';
import { GoalAction, GoalActionSchema } from '../users/schemas/GoalAction.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Goal.name, schema: GoalSchema },
      { name: GoalAction.name, schema: GoalActionSchema },
    ]),
  ],
  controllers: [GoalsController],
  providers: [GoalsService],
})
export class GoalsModule {}
