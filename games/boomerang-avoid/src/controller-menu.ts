/** Pad menus share the same native controls and input/change handlers as keyboard users. */
export function focusIdentity(element: Element | null): string | null {
  if (!element) return null;
  if (element.id) return `#${CSS.escape(element.id)}`;
  const attributes=["data-action","data-pref","data-seat","data-field","data-config","data-lobby","data-pad","data-power-pool","data-online-seat"];
  const keys=attributes.filter(key=>element.hasAttribute(key));
  return keys.length?keys.map(key=>`[${key}="${CSS.escape(element.getAttribute(key)!)}"]`).join(""):null;
}
export function menuControls(): HTMLElement[] {
  const surface=document.querySelector("#app .modal-backdrop")||document.querySelector("#app");
  return Array.from(surface?.querySelectorAll<HTMLElement>("button,a,input,select,textarea,summary")||[])
    .filter(el=>{
      // Closed details can report offsetParent for their hidden form controls.
      for(let parent=el.parentElement;parent;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement&&!parent.open&&!(el.tagName==="SUMMARY"&&parent.firstElementChild===el))return false;
      return !!el.offsetParent&&el.getClientRects().length>0&&!el.matches(":disabled,[aria-disabled=true],[tabindex='-1']");
    });
}
export function adjustMenuControl(direction: number): boolean {
  const element=document.activeElement;
  if(element instanceof HTMLSelectElement){
    const available=Array.from(element.options).filter(option=>!option.disabled);
    const index=available.indexOf(element.selectedOptions[0]);
    const next=available[Math.max(0,Math.min(available.length-1,index+direction))];
    if(!next||next.value===element.value)return false;
    element.value=next.value;
  }else if(element instanceof HTMLInputElement&&element.type==="range"){
    const min=Number(element.min)||0,max=element.max?Number(element.max):100,step=Number(element.step)||1;
    const value=Math.max(min,Math.min(max,Number(element.value)+direction*step));
    if(value===Number(element.value))return false;
    element.value=String(value);
  }else return false;
  element.dispatchEvent(new Event("input",{bubbles:true}));
  element.dispatchEvent(new Event("change",{bubbles:true}));
  return true;
}
