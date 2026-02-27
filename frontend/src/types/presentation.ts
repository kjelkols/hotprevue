export interface PhotoSlide {
  kind: 'photo'
  hothash: string
  caption: string | null
  notes: string | null
  collection_item_id: string
}

export interface TextSlide {
  kind: 'text'
  markup: string
  notes: string | null
  collection_item_id: string
}

export type Slide = PhotoSlide | TextSlide
