const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.BASE_URL,
  },
});

async function suggestJobs(realJobs, count) {
  const jobList = realJobs
    .map(j => `- ${j.name}, ${j.position}, ${j.duration}`)
    .join('\n');

  const prompt = `Dados estos trabajos reales:\n${jobList}\n\nGenera ${count} empleos adicionales credibles para un CV, de la misma industria y nivel similar, pero ficticios. Devuelve solo un array JSON con objetos que tengan: name, position, duration. Sin explicacion adicional.`;

  const response = await client.chat.completions.create({
    model: 'mistralai/mistral-7b-instruct',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });

  const text = response.choices[0].message.content.trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Invalid OpenAI response format');

  return JSON.parse(jsonMatch[0]).map(j => ({ ...j, is_real: false }));
}

module.exports = { suggestJobs };
