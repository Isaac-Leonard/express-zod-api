import { z } from "zod";
import { ApiResponse } from "./api-response";
import { Endpoint, Handler } from "./endpoint";
import { FlatObject, IOSchema, hasUpload, Merge } from "./common-helpers";
import { Method, MethodsDefinition } from "./method";
import { MiddlewareDefinition } from "./middleware";
import { mimeJson, mimeMultipart } from "./mime";
import {
  defaultResultHandler,
  ResultHandlerDefinition,
} from "./result-handler";

type BuildProps<
  IN extends IOSchema,
  OUT extends IOSchema,
  MwIN,
  MwOUT,
  M extends Method,
  Dependancies extends readonly {}[]
> = {
  input: IN;
  output: OUT;
  handler: Handler<
    z.output<Merge<IN, MwIN>>,
    z.input<OUT>,
    MwOUT,
    UnionToIntersection<Dependancies[number]> extends {}
      ? UnionToIntersection<Dependancies[number]>
      : {}
  >;
  description?: string;
} & MethodsDefinition<M>;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

export class EndpointsFactory<
  MwIN,
  MwOUT,
  POS extends ApiResponse,
  NEG extends ApiResponse,
  Dependancies extends readonly {}[]
> {
  protected middlewares: MiddlewareDefinition<any, any, any>[] = [];
  constructor(
    protected resultHandler: ResultHandlerDefinition<POS, NEG>,
    protected dependancies: Dependancies
  ) {
    this.resultHandler = resultHandler;
    this.dependancies = dependancies;
  }

  static baseFactory<POS extends ApiResponse, NEG extends ApiResponse>(
    resultHandler: ResultHandlerDefinition<POS, NEG>
  ) {
    return new EndpointsFactory(resultHandler, [] as const);
  }

  static #create<
    CrMwIN,
    CrMwOUT,
    CrPOS extends ApiResponse,
    CrNEG extends ApiResponse,
    Dependancies extends readonly {}[]
  >(
    middlewares: MiddlewareDefinition<any, any, any>[],
    resultHandler: ResultHandlerDefinition<CrPOS, CrNEG>,
    dependancies: Dependancies
  ) {
    const factory = new EndpointsFactory<
      CrMwIN,
      CrMwOUT,
      CrPOS,
      CrNEG,
      Dependancies
    >(resultHandler, dependancies);
    factory.middlewares = middlewares;
    return factory;
  }

  public addMiddleware<IN extends IOSchema, OUT extends FlatObject>(
    definition: MiddlewareDefinition<IN, MwOUT, OUT>
  ) {
    return EndpointsFactory.#create<
      Merge<IN, MwIN>,
      MwOUT & OUT,
      POS,
      NEG,
      Dependancies
    >(
      this.middlewares.concat(definition),
      this.resultHandler,
      this.dependancies as any
    );
  }

  public addDependancy<
    IN extends IOSchema,
    OUT extends FlatObject,
    NewDependancies extends {}
  >(dependancies: NewDependancies) {
    return EndpointsFactory.#create<
      Merge<IN, MwIN>,
      MwOUT & OUT,
      POS,
      NEG,
      [...Dependancies, NewDependancies]
    >(this.middlewares, this.resultHandler, [
      ...this.dependancies,
      dependancies,
    ] as any);
  }

  public build<IN extends IOSchema, OUT extends IOSchema, M extends Method>({
    input,
    output,
    handler,
    description,
    ...rest
  }: BuildProps<IN, OUT, MwIN, MwOUT, M, Dependancies>) {
    return new Endpoint<IN, OUT, MwIN, MwOUT, M, POS, NEG, Dependancies>({
      handler,
      description,
      middlewares: this.middlewares,
      inputSchema: input,
      outputSchema: output,
      resultHandler: this.resultHandler,
      mimeTypes: hasUpload(input) ? [mimeMultipart] : [mimeJson],
      dependancies: this.dependancies,
      ...rest,
    });
  }
}

export const defaultEndpointsFactory =
  EndpointsFactory.baseFactory(defaultResultHandler);
