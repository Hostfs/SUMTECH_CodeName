import { localRepos } from "./local";
import type { Repos } from "./types";

export type * from "./types";

/** 앱 전체가 쓰는 저장소. 백엔드를 붙일 때는 여기만 바꾼다. */
export const repos: Repos = localRepos;
