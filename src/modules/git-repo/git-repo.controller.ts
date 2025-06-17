import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateGitRepoDto } from './dto/create-git-repo.dto';
import { UpdateGitRepoDto } from './dto/update-git-repo.dto';
import { GitRepoService } from './git-repo.service';

@Controller('git-repo')
export class GitRepoController {
  constructor(private readonly gitRepoService: GitRepoService) {}

  @Post()
  create(@Body() createGitRepoDto: CreateGitRepoDto) {
    return this.gitRepoService.create(createGitRepoDto);
  }

  @Get()
  findAll(@Query('page') page: number, @Query('limit') limit: number) {
    return this.gitRepoService.findAll(+page, +limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.gitRepoService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateGitRepoDto: UpdateGitRepoDto) {
    return this.gitRepoService.update(id, updateGitRepoDto);
  }
}
