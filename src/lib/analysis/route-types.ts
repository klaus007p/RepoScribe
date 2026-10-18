export type HttpMethod =
    | "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" | "ALL";

export interface RouteParam {
    name: string;
    catchAll: boolean;
    optional: boolean;
}

export interface DetectedRoute {
    framework: "nextjs-app-router" | "express";
    method: HttpMethod;
    path: string;
    pathParams: RouteParam[];
    queryParams: string[];
    validationSchemas: string[];
    statusCodes: number[];
    authHints: string[];
    filePath: string;
    line: number;
    certainty: "detected" | "partial";
    notes: string[];
}

export interface SourceFileInput {
    path: string;
    content: string;
}