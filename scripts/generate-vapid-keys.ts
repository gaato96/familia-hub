import webpush from "web-push";

/**
 * Genera el par de claves VAPID para Web Push.
 *
 * Correr UNA sola vez por proyecto y guardar el resultado en .env.local y en
 * Vercel. Si la clave pública cambia, TODAS las suscripciones existentes dejan
 * de servir en silencio: los navegadores siguen aceptando el envío pero el
 * push nunca llega. Si hay que rotarlas, hay que vaciar `push_subscriptions`
 * y hacer que cada dispositivo se vuelva a suscribir.
 */
const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log("Pegar en .env.local (y en las variables de entorno de Vercel):\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log(`VAPID_SUBJECT=mailto:aplicaciones@leadadgo.com`);
