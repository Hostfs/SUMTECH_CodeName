import { Router } from 'express'
import { careRouter } from './care.js'
import { garmentsRouter } from './garments.js'
import { imagesRouter } from './images.js'
import { labelsRouter } from './labels.js'
import { metaRouter } from './meta.js'
import { movesRouter } from './moves.js'
import { outfitsRouter } from './outfits.js'
import { placementsRouter } from './placements.js'
import { productsRouter } from './products.js'
import { spacesRouter } from './spaces.js'
import { weatherRouter } from './weather.js'

/** 로그인이 필요한 /api/** 주소. 각 라우터는 /api 아래의 전체 경로(예: /garments/:id)를 직접 갖는다. */
export const apiRouter = Router()
for (const r of [metaRouter, garmentsRouter, imagesRouter, labelsRouter, productsRouter, spacesRouter, placementsRouter, movesRouter, careRouter, outfitsRouter, weatherRouter]) {
  apiRouter.use(r)
}
