/** @type {import('next').NextConfig} */
const nextConfig = {
  // მონაცემთა ფაილები სერვერულ ფუნქციებში უნდა მოხვდეს (Vercel და მსგავსი ჰოსტინგისთვის)
  outputFileTracingIncludes: {
    "/api/**": ["./data/**/*"],
    "/councils/**": ["./data/**/*"],
    "/parts/**": ["./data/**/*"],
    "/search": ["./data/**/*"],
  },
};
export default nextConfig;
