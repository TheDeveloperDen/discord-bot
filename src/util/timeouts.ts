export async function awaitTimeout(delay: number) {
  return await new Promise((resolve) => setTimeout(resolve, delay));
}
