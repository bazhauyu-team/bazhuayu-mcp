import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import messages from '../../config/messages.js';
import { createWidgetToolResult } from '../ui-result.js';
import type { ToolUiBinding } from '../tool-ui-contract.js';

interface TemplateCard {
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
  pricePerData?: number | null;
  priceLabel?: string;
  lastModificationTime?: string | null;
  lastModifiedLabel?: string;
  kindLabels?: string[];
  note?: string;
  downloadUrl?: string;
  sourceOptions?: unknown;
  inputSchema?: unknown;
  outputSchema?: unknown;
}

interface SearchTemplatesLikeResult {
  success?: boolean;
  error?: string;
  message?: string;
  queryMode?: string;
  selectedTemplateRef?: {
    templateId?: number;
    templateName?: string;
    displayName?: string;
  } | null;
  generatedParameterSummary?: string;
  generatedExecuteTaskSuggestion?: string;
  nextStepHint?: string;
  template?: TemplateCard;
  templates?: TemplateCard[];
  recommendedTemplate?: Record<string, unknown> | null;
  page?: number;
  pageSize?: number;
  totalMatchingTemplates?: number;
  topRelevanceMatchLocalOnly?: Record<string, unknown>;
  localCollectionGuidance?: Record<string, unknown>;
  noteLocalOnlyAlsoMatched?: Record<string, unknown>;
  noCloudTemplatesFound?: Record<string, unknown>;
}

function formatPriceLabel(value: number | null | undefined): string {
  if (value === null || value === undefined || value <= 0) {
    return 'No Extra Cost';
  }
  return `$${value}/1000 lines`;
}

function formatDateLabel(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString().slice(0, 10);
}

function inferTemplateIcon(template: TemplateCard): string {
  const haystack = `${template.displayName || ''} ${(template.kindLabels || []).join(' ')}`.toLowerCase();
  if (haystack.includes('google')) return 'search-engine';
  if (haystack.includes('map')) return 'maps';
  if (haystack.includes('social')) return 'social-media';
  if (haystack.includes('contact')) return 'contact';
  return 'generic-template';
}

function buildCards(result: SearchTemplatesLikeResult) {
  const rawCards = Array.isArray(result.templates)
    ? result.templates
    : result.template
      ? [result.template]
      : [];

  return rawCards.map((template) => ({
    templateName: template.templateName ?? '',
    displayName: template.displayName ?? template.templateName ?? '',
    shortDescription: template.shortDescription ?? '',
    imageUrl: template.imageUrl,
    selectable: template.selectable,
    selectionMode: template.selectionMode,
    templateRef: template.templateRef
      ? {
        templateId: template.templateRef.templateId,
        templateName: template.templateRef.templateName,
        displayName: template.templateRef.displayName
      }
      : undefined,
    supportsCloudScraping: template.supportsCloudScraping ?? false,
    runOnLabel: template.runOnLabel ?? 'Unknown',
    popularityLikes: template.popularityLikes ?? 0,
    kindLabels: template.kindLabels ?? [],
    priceLabel: template.priceLabel ?? formatPriceLabel(template.pricePerData),
    lastModifiedLabel: template.lastModifiedLabel ?? formatDateLabel(template.lastModificationTime),
    note: template.note,
    downloadUrl: template.downloadUrl,
    iconKey: inferTemplateIcon(template),
    sourceOptions: template.sourceOptions,
    inputSchema: template.inputSchema,
    outputSchema: template.outputSchema
  }));
}

function buildBanner(result: SearchTemplatesLikeResult): Record<string, unknown> | undefined {
  return (
    result.localCollectionGuidance ||
    result.topRelevanceMatchLocalOnly ||
    result.noteLocalOnlyAlsoMatched ||
    result.noCloudTemplatesFound
  );
}

function compactWidgetCard(card: ReturnType<typeof buildCards>[number]) {
  const {
    sourceOptions: _sourceOptions,
    inputSchema: _inputSchema,
    outputSchema: _outputSchema,
    ...compactCard
  } = card;

  return compactCard;
}

export function presentSearchTemplatesResult(
  result: SearchTemplatesLikeResult,
  binding: Pick<ToolUiBinding, 'resourceUri' | 'outputTemplate' | 'widgetAccessible'>
): CallToolResult {
  const cards = buildCards(result);
  const summary = result.success === false
    ? result.message || 'Template search failed.'
    : cards.length > 0
      ? `UI already shows the template cards. Found ${cards.length} template result${cards.length === 1 ? '' : 's'}.`
      : 'UI already shows the template cards. No template results matched the current query.';

  return createWidgetToolResult({
    binding: {
      ...binding,
      widgetAccessible: binding.widgetAccessible ?? true
    },
    text: summary,
    structuredContent: {
      success: result.success !== false,
      queryMode: result.queryMode ?? 'keyword',
      recommendedTemplate: result.recommendedTemplate ?? null,
      selectedTemplateRef: result.selectedTemplateRef ?? null,
      generatedParameterSummary: result.generatedParameterSummary ?? '',
      generatedExecuteTaskSuggestion: result.generatedExecuteTaskSuggestion ?? '',
      nextStepHint: result.nextStepHint ?? '',
      page: result.page ?? 1,
      pageSize: result.pageSize ?? cards.length,
      totalMatchingTemplates: result.totalMatchingTemplates ?? cards.length,
      widgetRendered: true,
      templates: cards.map((card) => ({
        templateName: card.templateName,
        displayName: card.displayName,
        selectionMode: card.selectionMode,
        templateRef: card.templateRef
      })),
      ...(result.success === false && result.error ? { error: result.error } : {})
    },
    widgetData: {
      widgetType: 'search-templates',
      cards: cards.map(compactWidgetCard),
      selectedTemplateRef: result.selectedTemplateRef ?? null,
      generatedParameterSummary: result.generatedParameterSummary ?? '',
      generatedExecuteTaskSuggestion: result.generatedExecuteTaskSuggestion ?? '',
      nextStepHint: result.nextStepHint ?? '',
      useTemplatePromptTemplate: messages.tools.searchTemplates.useTemplatePromptTemplate,
      banner: buildBanner(result),
      queryMode: result.queryMode ?? 'keyword',
      pagination: {
        page: result.page ?? 1,
        pageSize: result.pageSize ?? cards.length,
        total: result.totalMatchingTemplates ?? cards.length
      }
    },
    isError: result.success === false
  });
}
