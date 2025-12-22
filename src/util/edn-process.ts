/**
 * Process.edn file parser
 *
 * Parses transaction process definitions from EDN format
 */

import * as edn from 'jsedn';
import { readFileSync } from 'node:fs';

export interface ProcessState {
  name: string;
  in: string[];
  out: string[];
}

export interface ProcessTransition {
  name: string;
  from: string;
  to: string;
  actor: string;
  privileged?: boolean;
  actions?: Array<{ name: string; config?: unknown }>;
}

export interface ProcessNotification {
  name: string;
  on: string;
  to: string;
  template: string;
}

export interface ProcessDefinition {
  name: string;
  version?: number;
  states: ProcessState[];
  transitions: ProcessTransition[];
  notifications: ProcessNotification[];
}

/**
 * Converts EDN keyword to string
 */
function ednKeywordToString(kw: unknown): string {
  if (kw && typeof kw === 'object' && 'name' in kw) {
    return (kw as { name: string }).name;
  }
  return String(kw);
}

/**
 * Parses a process.edn file
 */
export function parseProcessFile(filePath: string): ProcessDefinition {
  const content = readFileSync(filePath, 'utf-8');
  const parsed = edn.parse(content);

  // Extract process data from EDN map
  const nameKw = edn.kw(':name');
  const statesKw = edn.kw(':states');
  const transitionsKw = edn.kw(':transitions');
  const notificationsKw = edn.kw(':notifications');

  const name = ednKeywordToString(parsed.at(nameKw));
  const statesData = parsed.at(statesKw) || [];
  const transitionsData = parsed.at(transitionsKw) || [];
  const notificationsData = parsed.at(notificationsKw) || [];

  // Parse states
  const states: ProcessState[] = [];
  if (Array.isArray(statesData)) {
    for (const state of statesData) {
      states.push({
        name: ednKeywordToString(state.at(edn.kw(':name'))),
        in: (state.at(edn.kw(':in')) || []).map(ednKeywordToString),
        out: (state.at(edn.kw(':out')) || []).map(ednKeywordToString),
      });
    }
  }

  // Parse transitions
  const transitions: ProcessTransition[] = [];
  if (Array.isArray(transitionsData)) {
    for (const transition of transitionsData) {
      transitions.push({
        name: ednKeywordToString(transition.at(edn.kw(':name'))),
        from: ednKeywordToString(transition.at(edn.kw(':from'))),
        to: ednKeywordToString(transition.at(edn.kw(':to'))),
        actor: ednKeywordToString(transition.at(edn.kw(':actor'))),
        privileged: transition.at(edn.kw(':privileged?')) || false,
        actions: transition.at(edn.kw(':actions')) || [],
      });
    }
  }

  // Parse notifications
  const notifications: ProcessNotification[] = [];
  if (Array.isArray(notificationsData)) {
    for (const notification of notificationsData) {
      notifications.push({
        name: ednKeywordToString(notification.at(edn.kw(':name'))),
        on: ednKeywordToString(notification.at(edn.kw(':on'))),
        to: ednKeywordToString(notification.at(edn.kw(':to'))),
        template: ednKeywordToString(notification.at(edn.kw(':template'))),
      });
    }
  }

  return {
    name,
    states,
    transitions,
    notifications,
  };
}

/**
 * Serializes a process definition to EDN format
 */
export function serializeProcess(process: ProcessDefinition): string {
  // For now, return a simplified EDN representation
  // A full implementation would properly serialize to EDN format
  return `{:name :${process.name}
 :states [${process.states.map((s) => `{:name :${s.name} :in [${s.in.map((i) => `:${i}`).join(' ')}] :out [${s.out.map((o) => `:${o}`).join(' ')}]}`).join('\n          ')}]
 :transitions [${process.transitions.map((t) => `{:name :${t.name} :from :${t.from} :to :${t.to} :actor :${t.actor}}`).join('\n               ')}]
 :notifications [${process.notifications.map((n) => `{:name :${n.name} :on :${n.on} :to :${n.to} :template :${n.template}}`).join('\n                 ')}]}`;
}
