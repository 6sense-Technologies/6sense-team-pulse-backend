import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { CreateGoalActionDto } from './dto/create-goal-action.dto';

@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  create(@Body() createGoalDto: CreateGoalDto) {
    return this.goalsService.create(createGoalDto);
  }

  @Get('user')
  findAll(
    @Query('userId') userId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.goalsService.findAll(userId, +page, +limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    console.log(id);
    return this.goalsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string) {
    return this.goalsService.update(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.goalsService.remove(id);
  }

  @Post('action')
  createAction(@Body() createGoalActionDto: CreateGoalActionDto) {
    return this.goalsService.createAction(createGoalActionDto);
  }

  @Get(':id/actions')
  findAllAction(
    @Param('id') id: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.goalsService.findAllAction(id, +page, +limit);
  }

  @Get(':id/actions/:actionId')
  findOneAction(@Param('actionId') id: string) {
    return this.goalsService.findOneAction(id);
  }
}
