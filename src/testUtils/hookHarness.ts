import React from 'react';
/** Test-only dispatcher; browser checks cover React mounting/DOM behaviour separately. */
export function createHookHarness() {
  const values: any[] = [];
  const dependencies: Array<readonly unknown[] | undefined> = [];
  const cleanups: Array<(() => void) | void> = [];
  const effects: Array<() => void> = [];
  let index = 0;
  const changed = (at: number, deps?: readonly unknown[]) => !dependencies[at] || !deps || deps.length !== dependencies[at]!.length || deps.some((v,i)=>v!==dependencies[at]![i]);
  const dispatcher = {
    useState(initial: any) { const at=index++; if (!(at in values)) values[at]=typeof initial==='function'?initial():initial; return [values[at], (next: any)=>{values[at]=typeof next==='function'?next(values[at]):next;}]; },
    useRef(initial: any) { const at=index++; if (!(at in values)) values[at]={current:initial}; return values[at]; },
    useMemo(factory: ()=>unknown, deps?: readonly unknown[]) {const at=index++; if(changed(at,deps)){values[at]=factory();dependencies[at]=deps;}return values[at];},
    useCallback(callback: unknown, deps?: readonly unknown[]) { return dispatcher.useMemo(()=>callback,deps); },
    useEffect(effect: ()=>void|(()=>void), deps?: readonly unknown[]) { const at=index++; if(changed(at,deps)){dependencies[at]=deps;effects.push(()=>{cleanups[at]?.(); cleanups[at]=effect();});} },
  };
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  return {
    run<T>(hook: ()=>T): T { index=0;const prior=internals.H;internals.H=dispatcher;try{const result=hook();effects.splice(0).forEach(effect=>effect());return result;}finally{internals.H=prior;} },
    cleanup(){cleanups.forEach(cleanup=>cleanup?.());},
  };
}
export function deferred<T>() {let resolve!: (value:T)=>void;let reject!: (error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
export const flush = async () => { for(let i=0;i<12;i++) await Promise.resolve(); };
