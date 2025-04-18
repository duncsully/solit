import { TemplateResult } from 'lit-html'
import { html } from '../../html'
import { styleMap } from 'lit-html/directives/style-map.js'
import { when } from 'lit-html/directives/when.js'

export enum Suit {
  Clubs = '♣',
  Diamonds = '♦',
  Hearts = '♥',
  Spades = '♠',
}

export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'

type Props = {
  faceUp: boolean
  suit?: Suit
  rank?: Rank
  onClick?: (e: Event) => void
  onDoubleClick?: (e: Event) => void
  stacked?: TemplateResult
  selected?: boolean
}

export const Card = ({
  suit,
  rank,
  faceUp,
  onClick,
  onDoubleClick,
  stacked,
  selected,
}: Props) => {
  const color = suit === Suit.Clubs || suit === Suit.Spades ? 'black' : 'red'
  return html`
    <div
      @click=${onClick}
      @dblclick=${onDoubleClick}
      @dragstart=${onClick}
      @drop=${onClick}
      @dragover=${(e: DragEvent) => e.preventDefault()}
      draggable="true"
      style=${styleMap({
        boxShadow: selected ? '0 0 0.75rem lime' : 'none',
        width: 'fit-content',
        borderRadius: '0.75rem',
        zIndex: selected ? '1' : '0',
        position: 'relative',
        userSelect: 'none',
      })}
    >
      <div
        style=${styleMap({
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: '1px solid darkgrey',
          borderRadius: '0.75rem',
          width: '10rem',
          height: '14rem',
          fontSize: '2rem',
          position: 'relative',
          cursor: onClick ? 'pointer' : 'default',
          backgroundColor: faceUp ? 'white' : 'lightblue',
          color,
        })}
      >
        ${when(
          faceUp,
          () => html`<div style=${styleMap({ margin: '0.5rem' })}>
              <div>
                ${rank}<span style=${styleMap({ fontSize: '1.5rem' })}
                  >${suit}</span
                >
              </div>
            </div>
            <div
              style=${styleMap({
                margin: '0.5rem',
                transform: 'rotateZ(180deg)',
              })}
            >
              <div>
                ${rank}<span style=${styleMap({ fontSize: '1.5rem' })}
                  >${suit}</span
                >
              </div>
            </div> `
        )}
      </div>
      ${when(
        stacked,
        () =>
          html`<div style=${styleMap({ marginTop: '-11.5rem' })}>
            ${stacked}
          </div>`
      )}
    </div>
  `
}
