// Positions are fractions of the space available to the entire companion.
function axis(viewport, size) {
  const margin=Math.min(12,Math.max(0,(viewport-size)/2))
  return {margin,range:Math.max(0,viewport-size-2*margin)}
}
export function petPositionPixels(position,viewport,box) {
  const x=axis(viewport.width,box.width),y=axis(viewport.height,box.height)
  return {left:x.margin+position.x*x.range,top:y.margin+position.y*y.range}
}
export function petPositionAt(left,top,viewport,box) {
  const x=axis(viewport.width,box.width),y=axis(viewport.height,box.height)
  const fraction=(pixel,axis)=>axis.range?Math.min(1,Math.max(0,(pixel-axis.margin)/axis.range)):0
  return {x:fraction(left,x),y:fraction(top,y)}
}
