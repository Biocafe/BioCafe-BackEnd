import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { GptService } from './gpt.service';
import { JwtAuthGuard } from '../autenticador/jwt.guard';

@Controller('gpt')
export class GptController {
  constructor(private readonly gptService: GptService) {}

  @UseGuards(JwtAuthGuard)
  @Post('consultar')
  async consultarGpt(@Body() body: { prompt: string }) {
    return this.gptService.consultarGpt(body.prompt);
  }

  // Endpoint público para GPT personalizado AURA
  @Post('aura')
  async consultarAura(@Body() body: { prompt: string }) {
    return this.gptService.consultarGpt(body.prompt);
  }
}
