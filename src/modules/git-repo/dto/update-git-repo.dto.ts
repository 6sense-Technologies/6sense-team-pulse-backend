import { PartialType } from '@nestjs/mapped-types';
import { CreateGitRepoDto } from './create-git-repo.dto';

export class UpdateGitRepoDto extends PartialType(CreateGitRepoDto) {}
