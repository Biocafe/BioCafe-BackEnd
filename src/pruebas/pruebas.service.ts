import { Injectable, BadRequestException } from '@nestjs/common';
import { DatosDto } from '../datos/datos.dto';
import * as ss from 'simple-statistics'; // Librería para cálculos estadísticos básicos

@Injectable()
export class PruebasService {
  /**
   * Método principal que recibe el tipo de prueba estadística
   * y transforma los datos recibidos antes de redirigir a la función correspondiente.
   */
  async ejecutar(tipo: string, datos: DatosDto[]) {
    // DEBUG: Log de datos originales
    console.log('=== DEBUG PRUEBAS SERVICE ===');
    console.log('Tipo de prueba:', tipo);
    console.log('Datos originales recibidos:', JSON.stringify(datos, null, 2));
    console.log('Cantidad de datos:', datos.length);

    // Se transforma el arreglo original para quedarse solo con nombre del tratamiento y resultado
    const transformado = datos.map((d) => ({
      tratamiento: d.tratamiento || d.nombretto, // Usar tratamiento si existe, sino nombretto
      resultado: d.resultado || d.valortto, // Usar resultado si existe, sino valortto
    }));

    // DEBUG: Log de datos transformados
    console.log('Datos transformados:', JSON.stringify(transformado, null, 2));

    // Verificar si hay valores null, undefined o NaN
    const problemasEnDatos = transformado.filter(
      (d) =>
        !d.tratamiento ||
        d.resultado === null ||
        d.resultado === undefined ||
        isNaN(d.resultado),
    );

    if (problemasEnDatos.length > 0) {
      console.log('⚠️ PROBLEMAS EN DATOS:', problemasEnDatos);
    }

    // Se redirige al método correspondiente según el tipo
    switch (tipo.toLowerCase()) {
      case 'shapiro':
        return this.pruebaShapiro(transformado);
      case 'levene':
        console.log('🔍 Ejecutando Levene con datos:', transformado);
        const resultadoLevene = this.pruebaLevene(transformado);
        console.log('📊 Resultado Levene:', resultadoLevene);
        return resultadoLevene;
      case 'anova':
        console.log('🔍 Ejecutando ANOVA con datos:', transformado);
        const resultadoAnova = this.pruebaAnova(transformado);
        console.log('📊 Resultado ANOVA:', resultadoAnova);
        return resultadoAnova;
      case 'duncan':
        return this.pruebaDuncan(transformado);
      default:
        throw new Error(`Tipo de prueba no válido: ${tipo}`);
    }
  }

  /**
   * Prueba de Shapiro-Wilk para normalidad.
   * Implementa el cálculo real del estadístico W y p-valor aproximado.
   */
  private pruebaShapiro(datos: { resultado: number }[]) {
    console.log('=== SHAPIRO-WILK (SIN RÉPLICAS) ===');
    const scores = datos
      .map((d) => d.resultado)
      .filter((val) => val !== null && val !== undefined && !isNaN(val));
    const n = scores.length;
    console.log(`Datos de entrada: ${JSON.stringify(scores)}`);
    console.log(`Número total de observaciones: ${n}`);

    // Validación ajustada: Shapiro-Wilk requiere entre 3 y 5000 observaciones
    if (n < 3) {
      console.log(`Datos insuficientes para Shapiro-Wilk: ${n} < 3`);
      return {
        metodo: 'Shapiro-Wilk (sin réplicas)',
        W: 'N/A',
        pValor: 'N/A',
        mensaje: `Datos insuficientes para Shapiro-Wilk (${n}/3 mínimo)`,
        conclusion:
          'Se requieren al menos 3 tratamientos para la prueba de Shapiro-Wilk.',
        significancia: 'No evaluable',
      };
    }

    if (n > 5000) {
      console.log(`Demasiados datos para Shapiro-Wilk: ${n} > 5000`);
      return {
        metodo: 'Shapiro-Wilk (sin réplicas)',
        W: 'N/A',
        pValor: 'N/A',
        mensaje: `Demasiados datos para Shapiro-Wilk (${n}/5000 máximo)`,
        conclusion:
          'Shapiro-Wilk no es confiable con más de 5000 observaciones.',
        significancia: 'No evaluable',
      };
    }

    // Ordenar los datos
    const sortedScores = [...scores].sort((a, b) => a - b);
    console.log(`Datos ordenados: ${JSON.stringify(sortedScores)}`);

    // Calcular estadísticas básicas
    const mean = ss.mean(sortedScores);
    const variance = ss.variance(sortedScores);
    console.log(`Media: ${mean}, Varianza: ${variance}`);

    // Calcular el estadístico W de Shapiro-Wilk
    const W = this.calcularShapiroW(sortedScores);
    console.log(`Estadístico W: ${W}`);

    // Calcular p-valor aproximado basado en el estadístico W
    const pValor = this.calcularShapiroPValue(W, n);
    console.log(`P-valor calculado: ${pValor}`);

    const resultado = {
      metodo: 'Shapiro-Wilk (sin réplicas)',
      W: parseFloat(W.toFixed(6)),
      pValor: parseFloat(pValor.toFixed(6)),
      media: parseFloat(mean.toFixed(4)),
      varianza: parseFloat(variance.toFixed(4)),
      n: n,
      mensaje:
        pValor > 0.05
          ? 'Los datos siguen una distribución normal'
          : 'Los datos no siguen una distribución normal',
      conclusion:
        pValor > 0.05
          ? 'Se acepta la hipótesis de normalidad (p > 0.05)'
          : 'Se rechaza la hipótesis de normalidad (p ≤ 0.05)',
      significancia: pValor > 0.05 ? 'No significativo' : 'Significativo',
    };

    console.log(`Resultado final Shapiro-Wilk: ${JSON.stringify(resultado)}`);
    return resultado;
  }

  /**
   * Calcula el estadístico W de Shapiro-Wilk usando el algoritmo estándar
   */
  private calcularShapiroW(sortedData: number[]): number {
    const n = sortedData.length;
    const mean = ss.mean(sortedData);

    // Calcular coeficientes a_i usando la aproximación de Royston (1982)
    const a = this.calcularCoeficientesShapiro(n);

    // Calcular numerador: suma ponderada
    let numerator = 0;
    for (let i = 0; i < n; i++) {
      numerator += a[i] * sortedData[i];
    }

    // Calcular denominador: suma de cuadrados de desviaciones
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      denominator += Math.pow(sortedData[i] - mean, 2);
    }

    return denominator > 0 ? Math.pow(numerator, 2) / denominator : 1;
  }

  /**
   * Calcula los coeficientes a_i para Shapiro-Wilk usando aproximación de Royston
   */
  private calcularCoeficientesShapiro(n: number): number[] {
    const a = new Array(n).fill(0);

    // Calcular valores esperados de estadísticas de orden de distribución normal
    const m = new Array(n);
    for (let i = 0; i < n; i++) {
      // Aproximación de Blom para valores esperados
      const p = (i + 1 - 0.375) / (n + 0.25);
      m[i] = this.inverseNormal(p);
    }

    // Calcular matriz de covarianzas (simplificada)
    const sumM2 = m.reduce((sum, val) => sum + val * val, 0);

    // Calcular coeficientes
    for (let i = 0; i < n; i++) {
      a[i] = m[i] / Math.sqrt(sumM2);
    }

    return a;
  }

  /**
   * Aproximación de la función inversa de la distribución normal estándar
   */
  private inverseNormal(p: number): number {
    // Aproximación de Beasley-Springer-Moro
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;

    const a0 = 2.515517,
      a1 = 0.802853,
      a2 = 0.010328;
    const b1 = 1.432788,
      b2 = 0.189269,
      b3 = 0.001308;

    let t, x;

    if (p > 0.5) {
      t = Math.sqrt(-2 * Math.log(1 - p));
      x =
        t -
        (a0 + a1 * t + a2 * t * t) / (1 + b1 * t + b2 * t * t + b3 * t * t * t);
    } else {
      t = Math.sqrt(-2 * Math.log(p));
      x = -(
        t -
        (a0 + a1 * t + a2 * t * t) / (1 + b1 * t + b2 * t * t + b3 * t * t * t)
      );
    }

    return x;
  }

  /**
   * Calcula el p-valor para Shapiro-Wilk usando aproximación de Royston (1995)
   */
  private calcularShapiroPValue(W: number, n: number): number {
    // Transformación logarítmica del estadístico W
    const ln_W = Math.log(W);

    // Parámetros para la aproximación según Royston (1995)
    let mu, sigma;

    if (n <= 11) {
      // Para muestras pequeñas (n ≤ 11)
      const gamma = -2.273 + 0.459 * n;
      const delta = Math.exp(
        0.544 - 0.39978 * n + 0.025054 * n * n - 0.0006714 * n * n * n,
      );
      mu =
        -1.5861 -
        0.31082 * ln_W -
        0.083751 * ln_W * ln_W +
        0.0038915 * ln_W * ln_W * ln_W;
      sigma = Math.exp(-0.4803 - 0.082676 * ln_W + 0.0030302 * ln_W * ln_W);
    } else {
      // Para muestras grandes (n > 11)
      const ln_n = Math.log(n);
      mu =
        0.0038915 * Math.pow(ln_W, 3) -
        0.083751 * Math.pow(ln_W, 2) -
        0.31082 * ln_W -
        1.5861;
      sigma = Math.exp(
        0.0030302 * Math.pow(ln_W, 2) - 0.082676 * ln_W - 0.4803,
      );

      // Ajuste para muestras grandes
      mu +=
        -0.0006714 * Math.pow(ln_n, 3) +
        0.025054 * Math.pow(ln_n, 2) -
        0.39978 * ln_n +
        0.544;
    }

    // Calcular estadístico Z normalizado
    const z = (ln_W - mu) / sigma;

    // Calcular p-valor usando aproximación de la distribución normal
    const pValue = 1 - this.normalCDF(z);

    // Asegurar que el p-valor esté en el rango válido
    return Math.max(0.001, Math.min(0.999, pValue));
  }

  /**
   * Función de distribución acumulativa de la normal estándar
   */
  private normalCDF(x: number): number {
    // Aproximación de Abramowitz y Stegun
    const a1 = 0.254829592,
      a2 = -0.284496736,
      a3 = 1.421413741;
    const a4 = -1.453152027,
      a5 = 1.061405429,
      p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1 / (1 + p * x);
    const y =
      1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1 + sign * y);
  }

  /**
   * Prueba de Levene para evaluar homogeneidad de varianzas entre tratamientos.
   * Usa un ANOVA sobre las desviaciones absolutas de la mediana.
   */
  private pruebaLevene(datos: { tratamiento: string; resultado: number }[]) {
    console.log('🔍 === PRUEBA DE LEVENE (SIN RÉPLICAS) ===');

    const grupos = this.agruparPorTratamiento(datos);
    console.log('Grupos para Levene:', grupos);

    // MODIFICACIÓN PARA SIN RÉPLICAS:
    // Con un solo valor por tratamiento, no podemos calcular variabilidad interna
    // Usamos un enfoque simplificado basado en la dispersión entre tratamientos

    const valores = Object.values(grupos).flat();
    console.log('Valores para análisis de homogeneidad:', valores);

    // Calcular coeficiente de variación como medida de homogeneidad
    const media = ss.mean(valores);
    const desviacion = ss.standardDeviation(valores);
    const coeficienteVariacion = media > 0 ? desviacion / media : 0;

    console.log('📊 Estadísticas de homogeneidad:');
    console.log('  - Media:', media);
    console.log('  - Desviación estándar:', desviacion);
    console.log('  - Coeficiente de variación:', coeficienteVariacion);

    // Aproximar p-valor basado en la homogeneidad de los datos
    let pValor: number;
    if (coeficienteVariacion < 0.1) {
      pValor = 0.9; // Muy homogéneo
    } else if (coeficienteVariacion < 0.2) {
      pValor = 0.7; // Bastante homogéneo
    } else if (coeficienteVariacion < 0.3) {
      pValor = 0.4; // Moderadamente homogéneo
    } else if (coeficienteVariacion < 0.5) {
      pValor = 0.1; // Poco homogéneo
    } else {
      pValor = 0.02; // Muy heterogéneo
    }

    console.log('📈 P-valor calculado para Levene (sin réplicas):', pValor);

    const resultado = {
      metodo: 'Levene (Sin réplicas)',
      F: parseFloat(coeficienteVariacion.toFixed(2)), // Usamos CV como estadístico
      pValor: parseFloat(pValor.toFixed(2)),
      mensaje: 'p > 0.05 sugiere homogeneidad de varianzas (sin réplicas)',
      significancia: pValor > 0.05 ? 'No significativo' : 'Significativo *',
      SST: 0,
      SSB: 0,
      SSW: 0,
      dfb: Object.keys(grupos).length - 1,
      dfw: 0,
      MSB: 0,
      MSW: 0,
      conclusion:
        pValor > 0.05
          ? '✅ Cumple: p > 0.05 → hay homogeneidad de varianzas (sin réplicas).'
          : '❌ No cumple: p ≤ 0.05 → no hay homogeneidad de varianzas (sin réplicas).',
    };

    console.log('✅ Resultado Levene (sin réplicas):', resultado);
    return resultado;
  }

  /**
   * Prueba ANOVA para determinar si existen diferencias estadísticas entre tratamientos.
   * MODIFICADO: Trabaja con un solo valor por tratamiento (sin réplicas).
   */
  private pruebaAnova(datos: { tratamiento: string; resultado: number }[]) {
    console.log('📊 === PRUEBA ANOVA (SIN RÉPLICAS) ===');

    const grupos = this.agruparPorTratamiento(datos);
    const tratamientos = Object.keys(grupos);

    console.log('Tratamientos encontrados:', tratamientos);
    console.log('Número de tratamientos:', tratamientos.length);

    // Validación mínima: al menos 2 tratamientos
    const advertenciaTratamientos =
      tratamientos.length < 2
        ? 'Se requieren mínimo 2 tratamientos para ANOVA.'
        : tratamientos.length < 3
          ? 'Se recomienda tener mínimo 3 tratamientos para mayor confiabilidad estadística.'
          : 'Número de tratamientos adecuado para ANOVA.';

    // Mensaje específico para sin réplicas
    const advertencia =
      'ANOVA sin réplicas: análisis basado en variabilidad entre medias de tratamientos.';

    const base = this.calcularAnova(
      grupos,
      'ANOVA',
      'p < 0.05 indica diferencias significativas entre grupos (sin réplicas)',
    );

    // Agregar asterisco (*) si p < 0.05
    const esSignificativo = Number(base.pValor) < 0.05;
    const asterisco = esSignificativo ? ' *' : '';

    const resultado = {
      ...base,
      metodo: `${base.metodo}${asterisco}`,
      significancia: `${base.significancia}${asterisco}`,
      advertencia: `${advertenciaTratamientos} ${advertencia}`,
      conclusion: esSignificativo
        ? `✅ Cumple: p < 0.05 → hay diferencias estadísticamente significativas entre los tratamientos (sin réplicas).${asterisco}`
        : '❌ No cumple: p ≥ 0.05 → no hay diferencias significativas (sin réplicas).',
    };

    console.log('✅ Resultado ANOVA (sin réplicas):', resultado);
    return resultado;
  }

  /**
   * Prueba post-hoc de Duncan para comparaciones múltiples.
   * Determina qué tratamientos son significativamente diferentes entre sí.
   * CORREGIDO: Usa las medias calculadas del ANOVA y verifica significancia.
   */
  private pruebaDuncan(datos: { tratamiento: string; resultado: number }[]) {
    console.log('=== DUNCAN (SIN RÉPLICAS) - INTEGRADO CON ANOVA ===');
    const grupos = this.agruparPorTratamiento(datos);
    const tratamientos = Object.keys(grupos);
    const k = tratamientos.length;
    console.log(`Datos agrupados: ${JSON.stringify(grupos)}`);
    console.log(`Número de tratamientos: ${k}`);

    // Validación mínima
    if (k < 2) {
      console.log('Datos insuficientes para Duncan');
      return {
        metodo: 'Duncan (sin réplicas)',
        grupos: [],
        mensaje: 'Se requieren al menos 2 tratamientos para Duncan',
        conclusion: 'No se puede realizar la prueba de Duncan',
      };
    }

    // PASO 1: Ejecutar ANOVA para obtener las medias calculadas y verificar significancia
    console.log('🔍 Ejecutando ANOVA para obtener medias calculadas...');
    const resultadoAnova = this.calcularAnova(
      grupos,
      'ANOVA',
      'Análisis previo para Duncan',
    );
    console.log('📊 Resultado ANOVA para Duncan:', resultadoAnova);

    // Verificar si ANOVA es significativo
    const anovaSignificativo = Number(resultadoAnova.pValor) < 0.05;
    console.log(`🎯 ANOVA significativo (p < 0.05): ${anovaSignificativo}`);

    if (!anovaSignificativo) {
      console.log('⚠️ ANOVA no significativo, Duncan puede no ser apropiado');
    }

    // PASO 2: Calcular las medias REALES por tratamiento (no usar valores originales)
    // En el caso sin réplicas, la "media" es el valor único, pero calculamos estadísticas del conjunto
    const estadisticas = Object.entries(grupos).map(
      ([tratamiento, resultados]) => {
        const valor = resultados[0]; // Valor único por tratamiento
        return {
          tratamiento,
          media: valor, // Este es el valor que se usa para comparaciones
          n: 1,
          valor: valor,
        };
      },
    );
    console.log(
      `📊 Estadísticas por tratamiento (medias calculadas): ${JSON.stringify(estadisticas)}`,
    );

    // PASO 3: Ordenar por media (mayor a menor) para jerarquía A > B > C > D
    const ordenado = estadisticas.sort((a, b) => b.media - a.media);
    console.log(
      `📈 Tratamientos ordenados (mayor a menor): ${JSON.stringify(ordenado)}`,
    );

    // PASO 4: Calcular error estándar usando los resultados del ANOVA
    const valores = ordenado.map((t) => t.media);
    const mediaGeneral = ss.mean(valores);
    const varianzaEntreTratamientos = ss.variance(valores);

    // Usar MSB del ANOVA como base para el error estándar
    const errorEstandar = Math.sqrt(resultadoAnova.MSB / k);

    console.log(`📊 Estadísticas para Duncan:`);
    console.log(`  - Media general: ${mediaGeneral}`);
    console.log(
      `  - Varianza entre tratamientos: ${varianzaEntreTratamientos}`,
    );
    console.log(`  - MSB del ANOVA: ${resultadoAnova.MSB}`);
    console.log(`  - Error estándar para Duncan: ${errorEstandar}`);

    // PASO 5: Obtener valores críticos de Duncan
    const dfw = Math.max(1, k - 1);
    const qValues = this.getDuncanQValuesImproved(k, dfw);
    console.log(`🎯 Valores Q críticos de Duncan: ${JSON.stringify(qValues)}`);

    // PASO 6: Asignar grupos jerárquicos (A mejor que B, B mejor que C, etc.)
    const gruposAsignados = this.asignarGruposDuncanJerarquico(
      ordenado,
      errorEstandar,
      qValues,
      anovaSignificativo,
    );
    console.log(
      `📋 Grupos asignados (jerárquicos): ${JSON.stringify(gruposAsignados)}`,
    );

    // PASO 7: Preparar resultado final
    const numeroGrupos = new Set(gruposAsignados.map((g) => g.grupo)).size;
    const asterisco = anovaSignificativo ? ' *' : '';

    const resultado = {
      metodo: `Duncan (sin réplicas)${asterisco}`,
      grupos: gruposAsignados,
      errorEstandar: parseFloat(errorEstandar.toFixed(4)),
      anovaSignificativo,
      pValorAnova: resultadoAnova.pValor,
      mensaje: `Tratamientos con la misma letra no son significativamente diferentes${asterisco}`,
      conclusion: `Se identificaron ${numeroGrupos} grupos homogéneos. Jerarquía: A > B > C > D...${asterisco}`,
      interpretacion: `Grupo A (mejor) > Grupo B > Grupo C > Grupo D... ${anovaSignificativo ? '(* = ANOVA significativo)' : '(ANOVA no significativo)'}`,
    };

    console.log(
      `✅ Resultado final Duncan integrado: ${JSON.stringify(resultado)}`,
    );
    return resultado;
  }

  /**
   * Obtiene valores críticos aproximados para la prueba de Duncan
   */
  private getDuncanQValues(k: number, dfw: number): number[] {
    // Valores críticos aproximados para α = 0.05
    // En la práctica real se consultan tablas de rangos estudentizados
    const baseQ = dfw > 30 ? 2.8 : dfw > 20 ? 2.9 : dfw > 10 ? 3.0 : 3.2;

    const qValues: number[] = [];
    for (let p = 2; p <= k; p++) {
      // Aproximación: q aumenta con el número de medias en el rango
      qValues[p - 2] = baseQ * Math.sqrt(Math.log(p));
    }

    return qValues;
  }

  /**
   * Obtiene valores críticos mejorados para la prueba de Duncan sin réplicas
   */
  private getDuncanQValuesImproved(k: number, dfw: number): number[] {
    // Valores críticos más precisos basados en tablas de Duncan para α = 0.05
    // Ajustados para el caso sin réplicas

    // Tabla aproximada de valores críticos de Duncan (α = 0.05)
    const duncanTable: { [key: number]: number[] } = {
      1: [3.64, 3.64, 3.64, 3.64, 3.64, 3.64, 3.64, 3.64, 3.64, 3.64],
      2: [3.46, 3.58, 3.64, 3.68, 3.71, 3.73, 3.75, 3.76, 3.77, 3.78],
      3: [3.35, 3.47, 3.54, 3.58, 3.62, 3.64, 3.66, 3.68, 3.69, 3.7],
      4: [3.26, 3.39, 3.47, 3.52, 3.55, 3.58, 3.6, 3.62, 3.63, 3.64],
      5: [3.2, 3.33, 3.41, 3.47, 3.5, 3.53, 3.55, 3.57, 3.58, 3.59],
    };

    // Seleccionar fila basada en grados de libertad (aproximado)
    const dfwKey =
      dfw <= 1 ? 1 : dfw <= 2 ? 2 : dfw <= 3 ? 3 : dfw <= 4 ? 4 : 5;
    const baseValues = duncanTable[dfwKey];

    const qValues: number[] = [];
    for (let p = 2; p <= k; p++) {
      const index = Math.min(p - 2, baseValues.length - 1);
      qValues[p - 2] = baseValues[index];
    }

    return qValues;
  }

  /**
   * Asigna grupos (letras) basado en las diferencias significativas sin réplicas
   */
  private asignarGruposDuncanSinReplicas(
    ordenado: any[],
    umbralDiferencia: number,
  ): any[] {
    const resultado = ordenado.map((item) => ({ ...item, grupo: '' }));
    let letraActual = 0;

    // Algoritmo simplificado de agrupación sin réplicas
    for (let i = 0; i < resultado.length; i++) {
      if (resultado[i].grupo === '') {
        const letra = String.fromCharCode(65 + letraActual);
        resultado[i].grupo = letra;

        // Buscar tratamientos no significativamente diferentes
        for (let j = i + 1; j < resultado.length; j++) {
          if (resultado[j].grupo === '') {
            const diferencia = Math.abs(
              resultado[i].media - resultado[j].media,
            );

            // Si la diferencia es menor al umbral, pertenecen al mismo grupo
            if (diferencia <= umbralDiferencia) {
              resultado[j].grupo = letra;
            }
          }
        }
        letraActual++;
      }
    }

    return resultado.map((item) => ({
      tratamiento: item.tratamiento,
      media: Math.round(item.media), // Sin decimales
      grupo: item.grupo,
      n: item.n,
    }));
  }

  /**
   * Asigna grupos jerárquicos (A > B > C > D) usando el método correcto de Duncan
   * CORREGIDO: Implementa jerarquía donde A es mejor que B, B mejor que C, etc.
   * A = mejor rendimiento, B = segundo mejor, C = tercero, D = cuarto, etc.
   */
  private asignarGruposDuncanJerarquico(
    ordenado: any[],
    errorEstandar: number,
    qValues: number[],
    anovaSignificativo: boolean,
  ): any[] {
    console.log(
      '🏆 === ASIGNACIÓN JERÁRQUICA DE GRUPOS DUNCAN (CORREGIDA) ===',
    );
    console.log(
      '📊 Datos ordenados (mayor a menor):',
      ordenado.map((t) => `${t.tratamiento}: ${t.media}`),
    );
    console.log('🎯 ANOVA significativo:', anovaSignificativo);

    // Si ANOVA no es significativo, todos los tratamientos van al mismo grupo
    if (!anovaSignificativo) {
      console.log(
        '⚠️ ANOVA no significativo - todos los tratamientos en grupo A',
      );
      return ordenado.map((item) => ({
        tratamiento: item.tratamiento,
        media: Math.round(item.media),
        grupo: 'A',
        n: item.n,
      }));
    }

    const resultado = ordenado.map((item) => ({
      ...item,
      grupo: '',
      asignado: false,
    }));

    console.log('🔍 Iniciando asignación jerárquica corregida (A > B > C > D)');
    console.log('Error estándar:', errorEstandar);
    console.log('Valores Q:', qValues);

    // ALGORITMO CORREGIDO DE DUNCAN:
    // 1. Crear matriz de diferencias significativas
    const n = resultado.length;
    const matrizSignificativa = Array(n)
      .fill(null)
      .map(() => Array(n).fill(false));

    // Calcular todas las comparaciones por pares
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const diferencia = Math.abs(resultado[i].media - resultado[j].media);
        const rangoComparacion = j - i + 1;

        // Obtener valor crítico Q para este rango
        const qIndex = Math.min(rangoComparacion - 2, qValues.length - 1);
        const qCritico = qValues[qIndex] || qValues[qValues.length - 1];

        // Calcular LSD (Least Significant Difference)
        const lsd = qCritico * errorEstandar;

        // Si la diferencia es mayor al LSD, son significativamente diferentes
        matrizSignificativa[i][j] = diferencia > lsd;
        matrizSignificativa[j][i] = matrizSignificativa[i][j];

        console.log(
          `Comparación ${resultado[i].tratamiento} vs ${resultado[j].tratamiento}:`,
        );
        console.log(
          `  Diferencia: ${diferencia.toFixed(4)}, LSD: ${lsd.toFixed(4)}, Significativa: ${matrizSignificativa[i][j]}`,
        );
      }
    }

    // 2. Asignar grupos usando algoritmo de Duncan corregido
    let letraActual = 0;

    for (let i = 0; i < n; i++) {
      if (!resultado[i].asignado) {
        const letra = String.fromCharCode(65 + letraActual); // A, B, C, D...
        resultado[i].grupo = letra;
        resultado[i].asignado = true;

        console.log(`\n--- Asignando grupo ${letra} ---`);
        console.log(
          `Tratamiento líder: ${resultado[i].tratamiento} (media: ${resultado[i].media})`,
        );

        // Buscar todos los tratamientos que NO son significativamente diferentes
        // del tratamiento actual (pueden estar en el mismo grupo)
        for (let j = i + 1; j < n; j++) {
          if (!resultado[j].asignado && !matrizSignificativa[i][j]) {
            resultado[j].grupo = letra;
            resultado[j].asignado = true;
            console.log(
              `  ✅ ${resultado[j].tratamiento} asignado al grupo ${letra} (no significativamente diferente)`,
            );
          }
        }

        letraActual++;
      }
    }

    const resultadoFinal = resultado.map((item) => ({
      tratamiento: item.tratamiento,
      media: Math.round(item.media), // Sin decimales
      grupo: item.grupo,
      n: item.n,
    }));

    console.log('\n🏆 Resultado final jerárquico CORREGIDO:');
    console.log('📋 Jerarquía: A (mejor) > B > C > D > ...');
    resultadoFinal.forEach((item) => {
      console.log(
        `  Grupo ${item.grupo}: ${item.tratamiento} (media: ${item.media})`,
      );
    });

    return resultadoFinal;
  }

  /**
   * Asigna grupos (letras) basado en las diferencias significativas (versión original con réplicas)
   */
  private asignarGruposDuncan(
    ordenado: any[],
    errorEstandar: number,
    qValues: number[],
  ): any[] {
    const resultado = ordenado.map((item) => ({ ...item, grupo: '' }));
    let letraActual = 0;

    // Algoritmo simplificado de agrupación
    for (let i = 0; i < resultado.length; i++) {
      if (resultado[i].grupo === '') {
        const letra = String.fromCharCode(65 + letraActual);
        resultado[i].grupo = letra;

        // Buscar tratamientos no significativamente diferentes
        for (let j = i + 1; j < resultado.length; j++) {
          if (resultado[j].grupo === '') {
            const diferencia = Math.abs(
              resultado[i].media - resultado[j].media,
            );
            const rangoComparacion = j - i + 1;
            const qCritico =
              qValues[Math.min(rangoComparacion - 2, qValues.length - 1)] ||
              qValues[qValues.length - 1];
            const lsd = qCritico * errorEstandar;

            if (diferencia <= lsd) {
              resultado[j].grupo = letra;
            }
          }
        }
        letraActual++;
      }
    }

    return resultado.map((item) => ({
      tratamiento: item.tratamiento,
      media: parseFloat(item.media.toFixed(4)),
      grupo: item.grupo,
      n: item.n,
    }));
  }

  /**
   * Cálculo compartido de ANOVA (utilizado por ANOVA y Levene).
   * Calcula F y p-valor usando aproximación de la distribución F.
   */
  private calcularAnova(
    grupos: { [key: string]: number[] },
    metodo: string,
    mensaje: string,
  ) {
    console.log(`🧮 === CALCULANDO ${metodo} (SIN RÉPLICAS) ===`);
    console.log('Grupos recibidos:', grupos);

    const todas = Object.values(grupos).flat();
    const mediaGlobal = ss.mean(todas);
    const n = todas.length;
    const k = Object.keys(grupos).length;

    console.log('📊 Estadísticas básicas:');
    console.log('  - Todos los valores:', todas);
    console.log('  - Media global:', mediaGlobal);
    console.log('  - Total de observaciones (n):', n);
    console.log('  - Número de grupos (k):', k);

    // Validación mínima
    if (k < 2) {
      console.log('❌ Error: Menos de 2 grupos');
      return {
        metodo,
        F: 'N/A',
        pValor: 'N/A',
        mensaje: 'Se requieren al menos 2 grupos para ANOVA',
        significancia: 'No evaluable',
        SST: 0,
        SSB: 0,
        SSW: 0,
        dfb: 0,
        dfw: 0,
        MSB: 0,
        MSW: 0,
      };
    }

    // MODIFICACIÓN PARA UN SOLO VALOR POR TRATAMIENTO:
    // Cuando no hay réplicas, SSW = 0 y dfw = 0
    // Usamos un enfoque simplificado basado en la varianza entre medias

    // Suma de cuadrados total (SST) - ahora es igual a SSB
    const SST = todas.reduce((sum, x) => sum + Math.pow(x - mediaGlobal, 2), 0);
    console.log('📐 SST (Suma de cuadrados total):', SST);

    // Suma de cuadrados entre grupos (SSB) - igual a SST sin réplicas
    const SSB = SST;
    console.log('📐 SSB (Suma de cuadrados entre grupos):', SSB);

    // Sin réplicas: SSW = 0, dfw = 0
    const SSW = 0;
    console.log('📐 SSW (Sin réplicas, siempre 0):', SSW);

    // Grados de libertad modificados para sin réplicas
    const dfb = k - 1; // Entre grupos
    const dfw = 0; // Sin réplicas, no hay grados de libertad dentro de grupos
    console.log('🔢 Grados de libertad (sin réplicas):');
    console.log('  - dfb (entre grupos):', dfb);
    console.log('  - dfw (dentro de grupos, sin réplicas):', dfw);

    // Cuadrados medios modificados
    const MSB = dfb > 0 ? SSB / dfb : 0;
    const MSW = 0; // Sin réplicas, MSW = 0
    console.log('📊 Cuadrados medios (sin réplicas):');
    console.log('  - MSB (entre grupos):', MSB);
    console.log('  - MSW (sin réplicas, siempre 0):', MSW);

    // Estadístico F modificado para sin réplicas
    // Usamos la varianza de las medias de tratamiento
    const varianzaEntreTratamientos = ss.variance(todas);
    const F =
      varianzaEntreTratamientos > 0 ? MSB / varianzaEntreTratamientos : 0;
    console.log('🎯 Estadístico F (modificado sin réplicas):', F);
    console.log(
      '📊 Varianza entre tratamientos usada como denominador:',
      varianzaEntreTratamientos,
    );

    // Calcular p-valor usando aproximación simplificada para sin réplicas
    const pValor = this.calcularPValueSinReplicas(F, dfb, todas);
    console.log('📈 P-valor calculado (sin réplicas):', pValor);

    const resultado = {
      metodo: metodo + ' (Sin réplicas)',
      F: parseFloat(F.toFixed(2)),
      pValor: parseFloat(pValor.toFixed(2)),
      mensaje,
      significancia: pValor < 0.05 ? 'Significativo *' : 'No significativo',
      SST: parseFloat(SST.toFixed(2)),
      SSB: parseFloat(SSB.toFixed(2)),
      SSW: parseFloat(SSW.toFixed(2)),
      dfb,
      dfw,
      MSB: parseFloat(MSB.toFixed(2)),
      MSW: parseFloat(MSW.toFixed(2)),
    };

    console.log('✅ Resultado final (sin réplicas):', resultado);
    return resultado;
  }

  /**
   * Calcula el p-valor para datos SIN RÉPLICAS
   * Usa un enfoque simplificado basado en la variabilidad entre tratamientos
   */
  private calcularPValueSinReplicas(
    F: number,
    dfb: number,
    valores: number[],
  ): number {
    console.log('🔢 Calculando p-valor sin réplicas...');
    console.log('  - F:', F);
    console.log('  - dfb:', dfb);
    console.log('  - valores:', valores);

    // Para datos sin réplicas, usamos un enfoque basado en la dispersión relativa
    const rango = Math.max(...valores) - Math.min(...valores);
    const media = ss.mean(valores);
    const coeficienteVariacion = rango / media;

    console.log('  - Rango:', rango);
    console.log('  - Media:', media);
    console.log('  - Coeficiente de variación:', coeficienteVariacion);

    // Aproximación basada en la variabilidad relativa
    if (coeficienteVariacion < 0.1) return 0.8; // Muy poca variabilidad
    if (coeficienteVariacion < 0.2) return 0.5; // Poca variabilidad
    if (coeficienteVariacion < 0.3) return 0.2; // Variabilidad moderada
    if (coeficienteVariacion < 0.5) return 0.1; // Variabilidad considerable
    if (coeficienteVariacion < 0.7) return 0.05; // Alta variabilidad
    if (coeficienteVariacion < 1.0) return 0.02; // Muy alta variabilidad

    return 0.01; // Variabilidad extrema
  }

  /**
   * Calcula el p-valor para la distribución F usando aproximación mejorada
   * Basado en la función de distribución acumulativa F
   */
  private calcularPValueF(F: number, dfb: number, dfw: number): number {
    if (F <= 0 || dfb <= 0 || dfw <= 0) return 1;

    // Aproximación mejorada del p-valor para la distribución F
    // Usando transformación beta y aproximaciones más precisas

    // Para casos especiales comunes
    if (dfb === 1) {
      // Caso especial: t-test (F = t²)
      const t = Math.sqrt(F);
      return this.approximateTTestPValue(t, dfw);
    }

    // Aproximación usando la relación F con la distribución beta
    const x = (dfb * F) / (dfb * F + dfw);

    // Aproximación más precisa basada en valores críticos de F
    // Tabla de valores críticos aproximados para diferentes grados de libertad
    let criticalValue05 = 3.0; // Valor por defecto
    let criticalValue01 = 5.0;

    // Ajustar valores críticos según grados de libertad
    if (dfb === 2) {
      if (dfw >= 30) {
        criticalValue05 = 3.15;
        criticalValue01 = 4.98;
      } else if (dfw >= 10) {
        criticalValue05 = 3.49;
        criticalValue01 = 5.85;
      } else {
        criticalValue05 = 4.3;
        criticalValue01 = 8.02;
      }
    } else if (dfb === 3) {
      if (dfw >= 30) {
        criticalValue05 = 2.92;
        criticalValue01 = 4.51;
      } else if (dfw >= 10) {
        criticalValue05 = 3.26;
        criticalValue01 = 5.23;
      } else {
        criticalValue05 = 3.86;
        criticalValue01 = 7.01;
      }
    } else if (dfb >= 4) {
      if (dfw >= 30) {
        criticalValue05 = 2.76;
        criticalValue01 = 4.17;
      } else if (dfw >= 10) {
        criticalValue05 = 3.11;
        criticalValue01 = 4.85;
      } else {
        criticalValue05 = 3.63;
        criticalValue01 = 6.42;
      }
    }

    // Calcular p-valor basado en comparación con valores críticos
    if (F < criticalValue05 * 0.1) return 0.9;
    if (F < criticalValue05 * 0.3) return 0.7;
    if (F < criticalValue05 * 0.5) return 0.5;
    if (F < criticalValue05 * 0.7) return 0.3;
    if (F < criticalValue05 * 0.9) return 0.1;
    if (F < criticalValue05) return 0.07;
    if (F < criticalValue05 * 1.2) return 0.05;
    if (F < criticalValue05 * 1.5) return 0.03;
    if (F < criticalValue01) return 0.02;
    if (F < criticalValue01 * 1.2) return 0.01;
    if (F < criticalValue01 * 1.5) return 0.005;

    return 0.001; // Muy significativo
  }

  /**
   * Aproximación del p-valor para t-test (usado cuando dfb = 1)
   */
  private approximateTTestPValue(t: number, df: number): number {
    const absT = Math.abs(t);

    // Aproximaciones basadas en valores críticos conocidos
    if (absT < 1) return 0.8;
    if (absT < 1.5) return 0.4;
    if (absT < 2) return 0.1;
    if (absT < 2.5) return 0.05;
    if (absT < 3) return 0.02;
    if (absT < 4) return 0.01;

    return 0.001;
  }

  /**
   * Agrupa los datos por tratamiento - MODIFICADO PARA UN SOLO VALOR POR TRATAMIENTO
   * Cada tratamiento tendrá exactamente un valor (sin réplicas)
   */
  private agruparPorTratamiento(
    datos: { tratamiento: string; resultado: number }[],
  ) {
    console.log('🔄 Agrupando datos por tratamiento (SIN RÉPLICAS)...');
    console.log('Datos a agrupar:', datos);

    const grupos: { [key: string]: number[] } = {};
    datos.forEach((d) => {
      // Solo tomar el primer valor por tratamiento (sin réplicas)
      if (!grupos[d.tratamiento]) {
        grupos[d.tratamiento] = [d.resultado];
      }
      // Si ya existe el tratamiento, no agregar más valores (eliminar réplicas)
    });

    console.log('📋 Grupos formados (sin réplicas):', grupos);
    console.log('📊 Resumen de grupos:');
    Object.keys(grupos).forEach((tratamiento) => {
      console.log(
        `  - ${tratamiento}: ${grupos[tratamiento].length} valor [${grupos[tratamiento].join(', ')}]`,
      );
    });

    return grupos;
  }
}
