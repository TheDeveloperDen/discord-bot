with import <nixpkgs> {};

stdenv.mkDerivation {
  name = "devdenbot";

  nativeBuildInputs = [ pkg-config ];

  buildInputs = [
    nodejs-18_x
    sentry-cli
    gccStdenv
    python39
    deno
    yarn
    cairo
    pango
    pkg-config
    nodePackages.node-gyp
    libpng
    librsvg
    pixman
    pkgs.darwin.apple_sdk.frameworks.CoreText
  ];

   postPhases = ''
      corepack enable
      corepack prepare yarn@3.2.2 --activate
    '';
}
