import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GptService } from './gpt.service';
import { GptController } from './gpt.controller';

@Module({
  imports: [ConfigModule],
  controllers: [GptController],
  providers: [GptService],
  exports: [GptService],
})
export class GptModule {}
