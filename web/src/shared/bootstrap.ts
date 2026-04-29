import { useEffect, useState } from 'react';

export type TemplateWidgetPayload = {
  isLoading?: boolean;
  selectedTemplateRef?: {
    templateId?: number;
    templateName?: string;
    displayName?: string;
  } | null;
  generatedParameterSummary?: string;
  generatedExecuteTaskSuggestion?: string;
  nextStepHint?: string;
  useTemplatePromptTemplate?: string;
  cards?: Array<{
    templateName?: string;
    displayName?: string;
    shortDescription?: string;
    imageUrl?: string;
    selectable?: boolean;
    selectionMode?: 'execute_task' | 'local_only';
    templateRef?: {
      templateId?: number;
      templateName?: string;
      displayName?: string;
    } | null;
    kindLabels?: string[];
    priceLabel?: string;
    popularityLikes?: number;
    lastModifiedLabel?: string;
    runOnLabel?: string;
    supportsCloudScraping?: boolean;
    note?: string;
    iconKey?: string;
    downloadUrl?: string;
    sourceOptions?: unknown;
    inputSchema?: unknown;
    outputSchema?: unknown;
  }>;
  banner?: {
    summary?: string;
    message?: string;
    hint?: string;
  } | null;
  pagination?: {
    page?: number;
    pageSize?: number;
    total?: number;
  };
  structuredContent?: {
    recommendedTemplate?: {
      displayName?: string;
      templateName?: string;
      reason?: string;
    } | null;
    selectedTemplateRef?: {
      templateId?: number;
      templateName?: string;
      displayName?: string;
    } | null;
    generatedParameterSummary?: string;
    generatedExecuteTaskSuggestion?: string;
    nextStepHint?: string;
  };
};

type TemplateStructuredTemplate = {
  templateName?: string;
  displayName?: string;
  shortDescription?: string;
  imageUrl?: string;
  selectable?: boolean;
  selectionMode?: 'execute_task' | 'local_only';
  templateRef?: {
    templateId?: number;
    templateName?: string;
    displayName?: string;
  };
  supportsCloudScraping?: boolean;
  runOnLabel?: string;
  popularityLikes?: number;
  kindLabels?: string[];
  priceLabel?: string;
  lastModifiedLabel?: string;
  downloadUrl?: string;
  sourceOptions?: unknown;
  inputSchema?: unknown;
  outputSchema?: unknown;
};

type TemplateMetaCard = TemplateStructuredTemplate & {
  note?: string;
  iconKey?: string;
};

export type TaskWidgetPayload = {
  startTaskPromptTemplate?: string;
  stopTaskPromptTemplate?: string;
  rows?: Array<{
    taskId?: string;
    taskName?: string;
    taskStatusLabel?: string;
    taskDescription?: string;
    author?: string;
    creationUserName?: string;
    version?: string;
    statusTone?: 'running' | 'stopped' | 'completed' | 'failed' | 'unknown';
  }>;
  pagination?: {
    page?: number;
    size?: number;
    total?: number;
    totalPages?: number;
  };
  filtersApplied?: Record<string, unknown>;
};

declare global {
  interface Window {
    openai?: {
      toolOutput?: unknown;
      toolResponseMetadata?: unknown;
      state?: {
        toolOutput?: unknown;
        toolResponseMetadata?: unknown;
      };
    };
    __bazhuayu_WIDGET_KIND__?: 'search-templates' | 'search-tasks';
  }
}

const SET_GLOBALS_EVENT_TYPE = 'openai:set_globals';

function createTemplateWaitingState(): TemplateWidgetPayload {
  return {
    isLoading: true,
    selectedTemplateRef: null,
    generatedParameterSummary: '',
    generatedExecuteTaskSuggestion: '',
    nextStepHint: '',
    cards: [],
    banner: null,
    pagination: {
      page: 1,
      pageSize: 0,
      total: 0
    },
    structuredContent: {
      recommendedTemplate: null
    }
  };
}

function createTaskFallback(): TaskWidgetPayload {
  return {
    rows: [
      {
        taskId: 'task-preview',
        taskName: 'Sample Cloud Task',
        taskStatusLabel: 'Completed',
        taskDescription: 'Fallback preview while waiting for host tool output.',
        author: 'bazhuayu',
        creationUserName: 'demo',
        version: '1.0.0',
        statusTone: 'completed'
      }
    ],
    startTaskPromptTemplate: 'Start task {taskId}.',
    stopTaskPromptTemplate: 'Stop task {taskId}.',
    pagination: {
      page: 1,
      size: 1,
      total: 1,
      totalPages: 1
    },
    filtersApplied: {}
  };
}

function readToolOutput(): unknown {
  return window.openai?.toolOutput ?? window.openai?.state?.toolOutput;
}

function readToolResponseMetadata(): unknown {
  return window.openai?.toolResponseMetadata ?? window.openai?.state?.toolResponseMetadata;
}

function inferTemplateIcon(
  displayName: string | undefined,
  kindLabels: string[] | undefined
): string {
  const haystack = `${displayName || ''} ${(kindLabels || []).join(' ')}`.toLowerCase();

  if (haystack.includes('google')) return 'search-engine';
  if (haystack.includes('map')) return 'maps';
  if (haystack.includes('social')) return 'social-media';
  if (haystack.includes('contact')) return 'contact';
  return 'generic-template';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeTemplateRef(value: unknown):
  | {
    templateId?: number;
    templateName?: string;
    displayName?: string;
  }
  | null {
  if (!isRecord(value)) {
    return null;
  }

  const normalized = {
    templateId: typeof value.templateId === 'number' ? value.templateId : undefined,
    templateName: typeof value.templateName === 'string' ? value.templateName : undefined,
    displayName: typeof value.displayName === 'string' ? value.displayName : undefined
  };

  return normalized.templateId !== undefined ||
    normalized.templateName !== undefined ||
    normalized.displayName !== undefined
    ? normalized
    : null;
}

function pickTextField(
  primary: Record<string, unknown> | undefined,
  fallback: Record<string, unknown> | undefined,
  key: 'generatedParameterSummary' | 'generatedExecuteTaskSuggestion' | 'nextStepHint'
): string {
  if (primary && key in primary) {
    return normalizeText(primary[key]);
  }

  if (fallback && key in fallback) {
    return normalizeText(fallback[key]);
  }

  return '';
}

function toTemplateCard(template: TemplateStructuredTemplate) {
  return {
    templateName: template.templateName,
    displayName: template.displayName || template.templateName,
    shortDescription: template.shortDescription,
    imageUrl: template.imageUrl,
    selectable: template.selectable,
    selectionMode: template.selectionMode,
    templateRef: normalizeTemplateRef(template.templateRef),
    supportsCloudScraping: template.supportsCloudScraping,
    runOnLabel: template.runOnLabel,
    popularityLikes: template.popularityLikes,
    kindLabels: template.kindLabels ?? [],
    priceLabel: template.priceLabel,
    lastModifiedLabel: template.lastModifiedLabel,
    iconKey: inferTemplateIcon(template.displayName || template.templateName, template.kindLabels),
    downloadUrl: template.downloadUrl,
    sourceOptions: template.sourceOptions,
    inputSchema: template.inputSchema,
    outputSchema: template.outputSchema
  };
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeRecommendedTemplate(
  structuredContent: Record<string, unknown> | undefined
): TemplateWidgetPayload['structuredContent'] {
  return {
    recommendedTemplate: structuredContent && isRecord(structuredContent.recommendedTemplate)
      ? {
        displayName:
          typeof structuredContent.recommendedTemplate.displayName === 'string'
            ? structuredContent.recommendedTemplate.displayName
            : undefined,
        templateName:
          typeof structuredContent.recommendedTemplate.templateName === 'string'
            ? structuredContent.recommendedTemplate.templateName
            : undefined,
        reason:
          typeof structuredContent.recommendedTemplate.reason === 'string'
            ? structuredContent.recommendedTemplate.reason
            : undefined
      }
      : null
  };
}

function pickTemplateSelectionFields(
  primary: Record<string, unknown> | undefined,
  fallback?: Record<string, unknown>
) {
  const selectedTemplateRef =
    normalizeTemplateRef(primary?.selectedTemplateRef) ??
    normalizeTemplateRef(fallback?.selectedTemplateRef);

  return {
    selectedTemplateRef,
    generatedParameterSummary: pickTextField(primary, fallback, 'generatedParameterSummary'),
    generatedExecuteTaskSuggestion: pickTextField(primary, fallback, 'generatedExecuteTaskSuggestion'),
    nextStepHint: pickTextField(primary, fallback, 'nextStepHint')
  };
}

function normalizeBanner(value: unknown): TemplateWidgetPayload['banner'] {
  if (!isRecord(value)) {
    return null;
  }

  return {
    summary: typeof value.summary === 'string' ? value.summary : undefined,
    message: typeof value.message === 'string' ? value.message : undefined,
    hint: typeof value.hint === 'string' ? value.hint : undefined
  };
}

function normalizePagination(
  value: unknown,
  cardCount: number
): NonNullable<TemplateWidgetPayload['pagination']> {
  if (!isRecord(value)) {
    return {
      page: 1,
      pageSize: cardCount,
      total: cardCount
    };
  }

  return {
    page: typeof value.page === 'number' ? value.page : 1,
    pageSize: typeof value.pageSize === 'number' ? value.pageSize : cardCount,
    total: typeof value.total === 'number' ? value.total : cardCount
  };
}

function createDegradedTemplatePayload(
  payload: Record<string, unknown>,
  structuredContent: Record<string, unknown> | undefined,
  meta: Record<string, unknown> | undefined
): TemplateWidgetPayload {
  const selection = pickTemplateSelectionFields(structuredContent, payload);

  return {
    isLoading: false,
    selectedTemplateRef: selection.selectedTemplateRef,
    generatedParameterSummary: selection.generatedParameterSummary,
    generatedExecuteTaskSuggestion: selection.generatedExecuteTaskSuggestion,
    nextStepHint: selection.nextStepHint,
    ...(typeof meta?.useTemplatePromptTemplate === 'string'
      ? { useTemplatePromptTemplate: meta.useTemplatePromptTemplate }
      : {}),
    cards: [],
    banner: normalizeBanner(meta?.banner),
    pagination: normalizePagination(meta?.pagination, 0),
    structuredContent: {
      ...normalizeRecommendedTemplate(structuredContent),
      ...(structuredContent && isRecord(structuredContent.selectedTemplateRef)
        ? { selectedTemplateRef: structuredContent.selectedTemplateRef as TemplateWidgetPayload['selectedTemplateRef'] }
        : {}),
      ...(typeof structuredContent?.generatedParameterSummary === 'string'
        ? { generatedParameterSummary: structuredContent.generatedParameterSummary }
        : {}),
      ...(typeof structuredContent?.generatedExecuteTaskSuggestion === 'string'
        ? { generatedExecuteTaskSuggestion: structuredContent.generatedExecuteTaskSuggestion }
        : {}),
      ...(typeof structuredContent?.nextStepHint === 'string'
        ? { nextStepHint: structuredContent.nextStepHint }
        : {})
    }
  };
}

function fromStructuredTemplatePayload(
  payload: Record<string, unknown>
): TemplateWidgetPayload | null {
  const templates = payload.templates;
  if (!Array.isArray(templates)) {
    return null;
  }

  const cards = templates
    .filter((item): item is TemplateStructuredTemplate => isRecord(item))
    .map((template) => toTemplateCard(template));

  const selection = pickTemplateSelectionFields(payload);

  return {
    isLoading: false,
    selectedTemplateRef: selection.selectedTemplateRef,
    generatedParameterSummary: selection.generatedParameterSummary,
    generatedExecuteTaskSuggestion: selection.generatedExecuteTaskSuggestion,
    nextStepHint: selection.nextStepHint,
    cards,
    pagination: {
      page: typeof payload.page === 'number' ? payload.page : 1,
      pageSize: typeof payload.pageSize === 'number' ? payload.pageSize : cards.length,
      total: typeof payload.totalMatchingTemplates === 'number'
        ? payload.totalMatchingTemplates
        : cards.length
    },
    structuredContent: normalizeRecommendedTemplate(payload)
  };
}

function fromMetaTemplatePayload(
  meta: Record<string, unknown>,
  structuredContent: Record<string, unknown> | undefined
): TemplateWidgetPayload | null {
  if (!Array.isArray(meta.cards)) {
    return null;
  }

  const cards = meta.cards
    .filter((item): item is TemplateMetaCard => isRecord(item))
    .map((template) => ({
      ...toTemplateCard(template),
      note: typeof template.note === 'string' ? template.note : undefined,
      iconKey: typeof template.iconKey === 'string' ? template.iconKey : undefined
    }));

  const pagination = normalizePagination(meta.pagination, cards.length);
  const banner = normalizeBanner(meta.banner);
  const selection = pickTemplateSelectionFields(meta, structuredContent);

  return {
    isLoading: false,
    selectedTemplateRef: selection.selectedTemplateRef,
    generatedParameterSummary: selection.generatedParameterSummary,
    generatedExecuteTaskSuggestion: selection.generatedExecuteTaskSuggestion,
    nextStepHint: selection.nextStepHint,
    ...(typeof meta.useTemplatePromptTemplate === 'string'
      ? { useTemplatePromptTemplate: meta.useTemplatePromptTemplate }
      : {}),
    cards,
    banner,
    pagination,
    structuredContent: normalizeRecommendedTemplate(structuredContent)
  };
}

function unwrapToolPayload<T>(kind: 'search-templates' | 'search-tasks', fallback: T): T {
  const toolOutput = readToolOutput();
  if (!toolOutput || typeof toolOutput !== 'object') {
    return fallback;
  }

  const payload = toolOutput as Record<string, unknown>;
  const metadata = readToolResponseMetadata();
  const meta = isRecord(metadata)
    ? metadata
    : isRecord(payload._meta)
      ? payload._meta
      : undefined;
  const structuredContent = isRecord(payload.structuredContent)
    ? payload.structuredContent
    : undefined;

  if (kind === 'search-templates') {
    if (meta) {
      const normalizedFromMetadata = fromMetaTemplatePayload(meta, structuredContent);
      if (normalizedFromMetadata) {
        return normalizedFromMetadata as T;
      }
    }
    const normalizedFromTopLevel = fromStructuredTemplatePayload(payload);
    if (normalizedFromTopLevel) {
      return normalizedFromTopLevel as T;
    }
    if (structuredContent) {
      const normalized = fromStructuredTemplatePayload(structuredContent);
      if (normalized) {
        return normalized as T;
      }
    }
    return createDegradedTemplatePayload(payload, structuredContent, meta) as T;
  }

  if (kind === 'search-tasks') {
    if (meta && Array.isArray(meta.rows)) {
      return {
        ...(meta as object)
      } as T;
    }
    if (Array.isArray(payload.rows)) {
      return payload as T;
    }
  }

  return fallback;
}

export function getTemplateWidgetPayload(): TemplateWidgetPayload {
  return unwrapToolPayload('search-templates', createTemplateWaitingState());
}

export function getTaskWidgetPayload(): TaskWidgetPayload {
  return unwrapToolPayload('search-tasks', createTaskFallback());
}

export function useTemplateWidgetPayload(): TemplateWidgetPayload {
  const [payload, setPayload] = useState<TemplateWidgetPayload>(() => getTemplateWidgetPayload());

  useEffect(() => {
    const syncPayload = () => {
      setPayload(getTemplateWidgetPayload());
    };

    syncPayload();
    window.addEventListener(SET_GLOBALS_EVENT_TYPE, syncPayload, {
      passive: true
    });

    return () => {
      window.removeEventListener(SET_GLOBALS_EVENT_TYPE, syncPayload);
    };
  }, []);

  return payload;
}

export function useTaskWidgetPayload(): TaskWidgetPayload {
  const [payload, setPayload] = useState<TaskWidgetPayload>(() => getTaskWidgetPayload());

  useEffect(() => {
    const syncPayload = () => {
      setPayload(getTaskWidgetPayload());
    };

    syncPayload();
    window.addEventListener(SET_GLOBALS_EVENT_TYPE, syncPayload, {
      passive: true
    });

    return () => {
      window.removeEventListener(SET_GLOBALS_EVENT_TYPE, syncPayload);
    };
  }, []);

  return payload;
}
