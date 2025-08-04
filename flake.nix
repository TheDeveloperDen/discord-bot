{
  description = "DevDenBot";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    treefmt-nix.url = "github:numtide/treefmt-nix";
  flake-parts.url = "github:hercules-ci/flake-parts";
  };


  outputs = inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [
        inputs.treefmt-nix.flakeModule
      ];
      systems = [ "x86_64-linux" "aarch64-linux" "aarch64-darwin" "x86_64-darwin" ];
      perSystem = { config, self', inputs', pkgs, system, ... }: {
        treefmt.config = {
          projectRootFile = "./flake.nix";
          package = pkgs.treefmt;
          programs.nixpkgs-fmt.enable = true;
        };

        devShells.default = pkgs.mkShell {

          buildInputs = with pkgs; [
            bun

            nodePackages.typescript
            nodePackages.typescript-language-server

            sentry-cli
            gccStdenv
            python3
            deno
            yarn
            cairo
            pango
            pkg-config
            nodePackages.node-gyp
            libpng
            librsvg
            pixman

          ] ++ (if system == "aarch64-darwin" then [ pkgs.darwin.apple_sdk.frameworks.CoreText ] else [ ]);
        };
      };
      flake = { };
    };
}
