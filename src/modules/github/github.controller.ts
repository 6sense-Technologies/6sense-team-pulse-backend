import { Controller, Get, Post, Query } from '@nestjs/common';
import { RequestMetadata } from 'src/common/request-metadata/request-metadata.decorator';
import { RequestMetadataDto } from 'src/common/request-metadata/request-metadata.dto';
import { GithubService } from './github.service';

@Controller('github')
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  // @Post()
  // create(@Body() createGithubDto: CreateGithubDto) {
  //   return this.githubService.create(createGithubDto);
  // }

  // @Get()
  // findAll() {
  //   return this.githubService.findAll();
  // }

  @Get('summary')
  getSummary(
    @Query('userId') userId: string,
    @Query('date') date: string,
    @RequestMetadata() requestMetadata: RequestMetadataDto,
  ) {
    return this.githubService.summary(userId, date, requestMetadata.timezoneRegion);
  }

  @Get('get-contributions')
  getContributions(
    @Query('userId') userId: string,
    @Query('date') date: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.githubService.getContributions(userId, date, +page, +limit);
  }

  // @Get('git-chart')
  // async getGitChart(
  //   @Query('userId') userId: string,
  //   @Query('date') date: string,
  // ) {
  //   return await this.githubService.getChart(userId, date);
  // }

  @Get('get-commits')
  getCommits(@Query('userId') userId: string) {
    return this.githubService.getCommits(userId);
  }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.githubService.findOne(+id);
  // }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateGithubDto: UpdateGithubDto) {
  //   return this.githubService.update(+id, updateGithubDto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.githubService.remove(+id);
  // }

  @Post('run-cron-now')
  runCronNow() {
    return this.githubService.cronGitContribution();
  }
}
