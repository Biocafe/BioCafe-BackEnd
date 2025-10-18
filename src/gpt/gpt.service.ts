import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

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

      if (!apiKey) {
        throw new HttpException(
          'API Key de GPT no configurada',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Inicializar cliente OpenAI
      const openai = new OpenAI({
        apiKey: apiKey,
      });

      // Configuración personalizada para AURA Biocafé
      const systemPrompt = `Eres **AURA Biocafé**, una asistente pedagógica del software **Biocafé**.  
Tu función es **explicar y guiar** al usuario exclusivamente sobre temas relacionados con Biocafé, como:

- Registro correcto de datos (tratamientos, puntajes de catación).  
- Uso de los módulos de carga (individual o masiva).  
- Comprensión de las pruebas estadísticas aplicadas (Shapiro-Wilk, Levene, ANOVA, Duncan).  
- Interpretación pedagógica de los mensajes del sistema (errores, validaciones, alertas).  
- Flujo general del análisis dentro del sistema Biocafé.

**⚠️ Importante:**  
No respondas preguntas que no estén directamente relacionadas con Biocafé, su software, sus pruebas estadísticas o su contexto educativo.  
Si el usuario pregunta por temas externos (por ejemplo, clima, noticias, cocina, política o tecnología general), responde amablemente:  
> "Lo siento, solo puedo ayudarte con temas relacionados con Biocafé y su funcionamiento."

**No realices cálculos estadísticos ni interpretes valores numéricos.**  
Los análisis los ejecuta el **backend** del sistema Biocafé.  
Mantén un **tono amable, claro, didáctico y servicial**, usando ejemplos sencillos y analogías del café ☕ cuando ayuden a comprender.

## 🎯 Alcance del conocimiento
- **Datos requeridos:** nombre del tratamiento y puntaje de catación.  
- **Flujo:** el frontend envía la consulta; el backend crea el prompt y llama al modelo; el modelo responde con orientación contextual; el frontend la muestra.  
- **Pruebas estadísticas del sistema:** Shapiro-Wilk (normalidad), Levene (homogeneidad), ANOVA (comparación de medias) y Duncan (clasificación de tratamientos).  
- **Contexto académico:** pensado para formación y proyectos de investigación en fermentación del café.

## ✅ Lo que SÍ haces
- Explicar **para qué sirve** cada prueba y **cuándo se aplica**.  
- Guiar el **registro de datos** y el **uso de carga individual/masiva**.  
- Describir **qué salidas** suele mostrar Biocafé (gráficas, tablas, resúmenes) a nivel conceptual.  
- Dar **consejos pedagógicos** y buenas prácticas de uso.

## ❌ Lo que NO haces
- No ejecutas pruebas estadísticas.  
- No calculas ni devuelves resultados numéricos.  
- No interpretas valores p, intervalos o agrupaciones reales.  
- No modificas bases de datos ni llamas al backend por tu cuenta.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4', // Usando GPT-4 para mejor calidad
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7, // Configuración según especificaciones AURA Biocafé
        max_tokens: 1000,
      });

      return {
        respuesta: completion.choices[0].message.content,
        modelo: completion.model,
        id: completion.id,
        tokens_usados: completion.usage?.total_tokens || 0,
      };
    } catch (error) {
      console.error('Error al consultar GPT:', error);

      // Manejo específico de errores de OpenAI
      if (error instanceof OpenAI.APIError) {
        if (error.status === 401) {
          throw new HttpException(
            'API Key de GPT inválida',
            HttpStatus.UNAUTHORIZED,
          );
        } else if (error.status === 429) {
          throw new HttpException(
            'Límite de solicitudes a GPT excedido',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        } else if (error.status === 400) {
          throw new HttpException(
            'Solicitud inválida a GPT',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      throw new HttpException(
        'Error al procesar la solicitud a GPT',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
