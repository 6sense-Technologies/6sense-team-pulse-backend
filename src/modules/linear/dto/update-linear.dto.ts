import { PartialType } from '@nestjs/swagger';
import { CreateLinearDto } from './create-linear.dto';

export class UpdateLinearDto extends PartialType(CreateLinearDto) {}
