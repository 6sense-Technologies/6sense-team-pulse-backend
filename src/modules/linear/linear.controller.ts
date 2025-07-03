import { Controller, Get, Post, Body, Patch, Param, Delete, Req, Query, Res } from '@nestjs/common';
import { LinearService } from './linear.service';
import { CreateLinearDto } from './dto/create-linear.dto';
import { UpdateLinearDto } from './dto/update-linear.dto';
import { Request } from 'express';

@Controller('linear')
export class LinearController {
  constructor(private readonly linearService: LinearService) {}

  @Get('connect')
  async connect(
    @Query('tool-id') toolId: string,
    @Req() req: Request
  ) {
    const host = `${req.protocol}://${req.host}`;
    const redirectUri = await this.linearService.connect(toolId, host);
    return { redirectUri };
  }

  @Get('callback')
  async callback(
    @Query('code') code: string, 
    @Query('tool-id') toolId: string,
    @Req() req: Request,
  ) {
    const host = `${req.protocol}://${req.host}`;
    await this.linearService.handleCallback(code, toolId, host);
    return { message: 'Tool connected successfully' };
  }

  @Get('fetch-today-issues')
  async fetchTodayIssues() {
    return this.linearService.fetchAndSaveIssuesFromLinear();
  }

  // @Get('callback')
  // async callback(
  //   @Query('code') code: string,
  // ) {

  @Post()
  create(@Body() createLinearDto: CreateLinearDto) {
    return this.linearService.create(createLinearDto);
  }

  @Get()
  findAll() {
    return this.linearService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.linearService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLinearDto: UpdateLinearDto) {
    return this.linearService.update(+id, updateLinearDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.linearService.remove(+id);
  }
}
