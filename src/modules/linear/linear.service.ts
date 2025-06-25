import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateLinearDto } from './dto/create-linear.dto';
import { UpdateLinearDto } from './dto/update-linear.dto';
import { ConfigService } from '@nestjs/config';
import { ToolService } from '../tool/tool.service';

@Injectable()
export class LinearService {
  constructor(
    // Inject any necessary services, e.g., ConfigService for environment variables
    private readonly configService: ConfigService,
    private readonly toolService: ToolService, // Assuming you have a ToolService to handle tool-related operations
  ) {}

  async connect() {
    // // Redirect user to Linear OAuth authorization URL
    const clientId = this.configService.getOrThrow<string>('LINEAR_CLIENT_ID');
    const redirectUri = this.configService.getOrThrow<string>('LINEAR_REDIRECT_URI');
    const state = 'SECURE_RANDOM';
    const scope = 'read';
    const url = `https://linear.app/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&scope=${scope}`;
    return url;
  }

  async handleCallback(code: string, toolId: string) {
    try {
      // Validate input
      if (!code || code.trim() === '') {
        throw new BadRequestException('Authorization code is required');
      }
      if (!toolId || toolId.trim() === '') {
        throw new BadRequestException('Tool ID is required');
      }
      const tool = await this.toolService.getToolById(toolId);
      if (!tool) {
        throw new NotFoundException(`Tool with ID ${toolId} not found`);
      }

      const clientId = this.configService.getOrThrow<string>('LINEAR_CLIENT_ID');
      const clientSecret = this.configService.getOrThrow<string>('LINEAR_CLIENT_SECRET');
      const redirectUri = this.configService.getOrThrow<string>('LINEAR_REDIRECT_URI');

      const params = new URLSearchParams();
      params.append('code', code);
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);
      params.append('redirect_uri', redirectUri);
      params.append('grant_type', 'authorization_code');

      const response = await fetch('https://api.linear.app/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        let errorMessage = 'Unknown error';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error_description || errorData.error || (await response.text());
        } catch (err) {
          errorMessage = `Failed to parse error response: ${err.message}`;
        }
        throw new UnauthorizedException(`Failed to exchange code for token: ${errorMessage}`);
      }

      const data = await response.json();
      const accessToken = data.access_token;
      if (!accessToken) {
        throw new UnauthorizedException('Access token not received from Linear');
      }

      await this.toolService.updateToolWithAccessToken(toolId, accessToken);

      console.log('OAuth callback data:', data);
      return data;
    } catch (error) {
      if (error instanceof HttpException) {
        error.getStatus = () => 200; // Ensure we handle known NestJS exceptions
        throw error; // Re-throw known NestJS HTTP exceptions
      }
      // Optionally log error here
      console.error('OAuth callback error:', error);
      throw new InternalServerErrorException('An unexpected error occurred during OAuth callback.');
    }
  }

  create(createLinearDto: CreateLinearDto) {
    return 'This action adds a new linear';
  }

  findAll() {
    return `This action returns all linear`;
  }

  findOne(id: number) {
    return `This action returns a #${id} linear`;
  }

  update(id: number, updateLinearDto: UpdateLinearDto) {
    return `This action updates a #${id} linear`;
  }

  remove(id: number) {
    return `This action removes a #${id} linear`;
  }
}
