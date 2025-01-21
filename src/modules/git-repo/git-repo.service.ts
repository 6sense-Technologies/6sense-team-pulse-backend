import { Injectable } from '@nestjs/common';
import { CreateGitRepoDto } from './dto/create-git-repo.dto';
import { UpdateGitRepoDto } from './dto/update-git-repo.dto';
import { GitRepo } from '../users/schemas/GitRepo.schema';
import mongoose, { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class GitRepoService {
  constructor(
    @InjectModel(GitRepo.name) private readonly gitRepoModel: Model<GitRepo>,
  ) {
    // Constructor for injecting userModel
  }

  create(createGitRepoDto: CreateGitRepoDto) {
    return this.gitRepoModel.create({
      provider: createGitRepoDto['provider'],
      user: new mongoose.Types.ObjectId(createGitRepoDto['user']),
      organization: createGitRepoDto['organization'],
      repo: createGitRepoDto['repo'],
      gitUsername: createGitRepoDto['gitUsername'],
    });
  }

  findAll(page: number = 1, limit: number = 10) {
    return this.gitRepoModel
      .find()
      .skip((page - 1) * limit)
      .limit(limit);
  }

  findOne(id: string) {
    return this.gitRepoModel.findOne({ _id: id }).populate('user');
  }

  update(id: string, updateGitRepoDto: UpdateGitRepoDto) {
    let data = {};
    if (updateGitRepoDto['provider'])
      data['provider'] = updateGitRepoDto['provider'];
    if (updateGitRepoDto['organization'])
      data['organization'] = updateGitRepoDto['organization'];
    if (updateGitRepoDto['repo']) data['repo'] = updateGitRepoDto['repo'];
    if (updateGitRepoDto['gitUsername'])
      data['gitUsername'] = updateGitRepoDto['gitUsername'];
    return this.gitRepoModel.findOneAndUpdate({ _id: id }, data);
  }

  remove(id: number) {
    return `This action removes a #${id} gitRepo`;
  }
}
