import { Controller, Get, Post, Body, Patch, Param, Delete, Req, Query, Res } from '@nestjs/common';
import { LinearService } from './linear.service';
import { CreateLinearDto } from './dto/create-linear.dto';
import { UpdateLinearDto } from './dto/update-linear.dto';
import { Response } from 'express';

@Controller('linear')
export class LinearController {
  constructor(private readonly linearService: LinearService) {}

  @Get('connect')
  async connect(
    @Query('tool-id') toolId: string,
    @Res() res: Response
  ) {
    const redirectUri = await this.linearService.connect(toolId);
    res.redirect(redirectUri);
  }

  @Get('callback')
  async callback(@Query('code') code: string, @Query('tool-id') toolId: string) {
    await this.linearService.handleCallback(code, toolId);
    // Handle the callback logic here, e.g., exchange code for access token
    // This is a placeholder; implement your logic to handle the callback
    // return { message: 'Callback received', code };
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
