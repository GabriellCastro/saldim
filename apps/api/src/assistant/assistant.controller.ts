import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator';
import { AssistantService } from './assistant.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get('alerts')
  alerts(@CurrentUser() user: AuthUser) {
    return this.assistant.alerts(user.id);
  }

  @Get('prompts')
  prompts(@CurrentUser() user: AuthUser) {
    return this.assistant.prompts(user.id);
  }

  @Get('usage')
  usage(@CurrentUser() user: AuthUser) {
    return this.assistant.usage(user.id);
  }

  @Get('messages')
  messages(@CurrentUser() user: AuthUser) {
    return this.assistant.messages(user.id);
  }

  @Post('messages')
  send(@CurrentUser() user: AuthUser, @Body() dto: SendMessageDto) {
    return this.assistant.send(user.id, dto.content);
  }
}
