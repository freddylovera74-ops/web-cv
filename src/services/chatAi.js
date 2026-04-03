const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: { 'HTTP-Referer': process.env.BASE_URL || '' },
});

// Keyword-based fallbacks for when AI is unavailable or slow
const FUNCTION_FALLBACKS = {
  camarero:      ['Atención al cliente y toma de comandas', 'Preparación y gestión de mesas', 'Cobro en caja y TPV', 'Mantenimiento del área de trabajo'],
  camarera:      ['Atención al cliente y toma de comandas', 'Preparación y gestión de mesas', 'Cobro en caja y TPV', 'Mantenimiento del área de trabajo'],
  cocinero:      ['Elaboración y presentación de platos', 'Control de calidad de ingredientes', 'Gestión y orden de la cocina', 'Cumplimiento de normas de higiene'],
  dependiente:   ['Atención y asesoramiento al cliente', 'Reposición y gestión de stock', 'Cobro en caja y gestión de devoluciones', 'Mantenimiento del espacio de venta'],
  operario:      ['Picking y packing de pedidos', 'Control y gestión de inventario', 'Carga y descarga de mercancía', 'Uso de PDA y herramientas logísticas'],
  almacen:       ['Recepción y clasificación de mercancía', 'Gestión de stock y ubicaciones', 'Preparación de pedidos para envío', 'Uso de carretilla elevadora y escáner'],
  conductor:     ['Reparto de paquetería en ruta asignada', 'Gestión de 80-120 entregas diarias con PDA', 'Atención al cliente en punto de entrega', 'Control y mantenimiento del vehículo'],
  repartidor:    ['Reparto de paquetería en ruta asignada', 'Gestión de entregas con PDA', 'Atención al cliente en punto de entrega', 'Control y cuidado del vehículo'],
  farmacia:      ['Dispensación de medicamentos con receta', 'Atención y consejo farmacéutico al paciente', 'Gestión de stock y pedidos a distribuidoras', 'Tramitación y control de recetas'],
  auxiliar:      ['Atención directa al cliente o paciente', 'Gestión de documentación y registros', 'Apoyo en las tareas del equipo', 'Control y reposición de materiales'],
  recepcionista: ['Recepción y bienvenida a clientes', 'Gestión de agenda y reservas', 'Atención telefónica y por email', 'Coordinación con otros departamentos'],
  limpieza:      ['Limpieza y desinfección de instalaciones', 'Uso de maquinaria y productos de limpieza', 'Gestión y separación de residuos', 'Control de materiales y reposición de consumibles'],
  administrativo:['Gestión y archivo de documentación', 'Atención telefónica y presencial', 'Soporte administrativo al equipo', 'Gestión de facturación y pedidos'],
  comercial:     ['Captación y fidelización de clientes', 'Gestión y seguimiento de cartera', 'Elaboración de presupuestos y ofertas', 'Consecución de objetivos de venta'],
  seguridad:     ['Control de accesos e identificación de personas', 'Vigilancia de instalaciones y perímetro', 'Redacción de informes de incidencias', 'Coordinación con fuerzas de seguridad'],
};

const DEFAULT_FUNCTIONS = [
  'Atención y servicio al cliente',
  'Trabajo coordinado en equipo',
  'Organización y gestión de tareas',
  'Cumplimiento de objetivos establecidos',
];

const DEFAULT_SKILLS = [
  'Atención al cliente',
  'Trabajo en equipo',
  'Puntualidad y responsabilidad',
  'Resolución de problemas',
  'Adaptabilidad',
];

function getFallbackFunctions(cargo) {
  const lower = (cargo || '').toLowerCase();
  for (const [key, funcs] of Object.entries(FUNCTION_FALLBACKS)) {
    if (lower.includes(key)) return funcs;
  }
  return DEFAULT_FUNCTIONS;
}

async function suggestJobFunctions(cargo) {
  try {
    const prompt = `Lista exactamente 4 funciones cortas y reales para el puesto de "${cargo}" en España. Devuelve SOLO un array JSON de strings. Sin texto adicional. Máximo 12 palabras por función. Ejemplo: ["Función 1","Función 2","Función 3","Función 4"]`;
    const response = await client.chat.completions.create({
      model: 'mistralai/mistral-7b-instruct',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 200,
    }, { timeout: 3500 });
    const text = response.choices[0].message.content.trim();
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) throw new Error('No array found');
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr) || arr.length === 0) throw new Error('Empty array');
    return arr.slice(0, 4).map(f => String(f).replace(/[<>"]/g, '').trim().slice(0, 120));
  } catch (e) {
    console.error('[ChatAI] suggestJobFunctions failed:', e.message);
    return getFallbackFunctions(cargo);
  }
}

async function suggestSkillsForJobs(jobs) {
  try {
    const cargos = jobs.map(j => j.cargo || j.position || '').filter(Boolean).join(', ');
    if (!cargos) return DEFAULT_SKILLS;
    const prompt = `Un candidato tiene experiencia como: ${cargos}. Lista 5 habilidades profesionales relevantes para su CV en España. Solo array JSON de strings cortos. Sin texto adicional.`;
    const response = await client.chat.completions.create({
      model: 'mistralai/mistral-7b-instruct',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 150,
    }, { timeout: 3500 });
    const text = response.choices[0].message.content.trim();
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) throw new Error('No array found');
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr) || arr.length === 0) throw new Error('Empty array');
    return arr.slice(0, 6).map(s => String(s).replace(/[<>"]/g, '').trim().slice(0, 80));
  } catch (e) {
    console.error('[ChatAI] suggestSkillsForJobs failed:', e.message);
    return DEFAULT_SKILLS;
  }
}

module.exports = { suggestJobFunctions, suggestSkillsForJobs };
