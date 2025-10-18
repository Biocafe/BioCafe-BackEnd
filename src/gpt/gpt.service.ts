import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class GptService {
  constructor(private configService: ConfigService) {}

  /**
   * Realiza una consulta al modelo GPT
   * @param prompt El texto de entrada para el modelo GPT
   * @returns La respuesta generada por el modelo GPT
   */
  async consultarGpt(prompt: string): Promise<any> {
    try {
      const apiKey = this.configService.get<string>('GPT_API_KEY');
      const apiUrl = this.configService.get<string>('GPT_API_URL');

      if (!apiKey) {
        throw new HttpException(
          'API Key de GPT no configurada',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const response = await axios.post(
        `${apiUrl}/chat/completions`,
        {
          model: 'gpt-3.5-turbo', // Puedes cambiar el modelo según tus necesidades
          messages: [
            { role: 'system', content: 'Eres un asistente útil para BioCafé.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
        },
      );

      return {
        respuesta: response.data.choices[0].message.content,
        modelo: response.data.model,
        id: response.data.id,
      };
    } catch (error) {
      console.error(
        'Error al consultar GPT:',
        error.response?.data || error.message,
      );

      if (error.response?.status === 401) {
        throw new HttpException(
          'API Key de GPT inválida',
          HttpStatus.UNAUTHORIZED,
        );
      } else if (error.response?.status === 429) {
        throw new HttpException(
          'Límite de solicitudes a GPT excedido',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new HttpException(
        'Error al procesar la solicitud a GPT',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
