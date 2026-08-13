export declare const BRAND: {
  readonly name: "Chimera"
  readonly nameLower: "chimera"
  readonly appId: "io.chimera.desktop"
  readonly scheme: "chimera"
  readonly version: "0.1.3"
  readonly gatewayUrl: "https://api.chimerahub.org/"
  readonly homepage: "https://chimerahub.org"
  readonly github: { readonly owner: "Duojiyi"; readonly repo: "chimera-code" }
  readonly issues: "https://github.com/Duojiyi/chimera-code/issues/new"
  readonly releases: "https://github.com/Duojiyi/chimera-code/releases"
}

export declare function brandUserCopy(text: string): string
export declare function brandUserCopy(text: unknown): unknown

export declare function brandUserDict<T extends Record<string, string>>(dict: T): T
