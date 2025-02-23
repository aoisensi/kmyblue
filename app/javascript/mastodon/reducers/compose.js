import { Map as ImmutableMap, List as ImmutableList, OrderedSet as ImmutableOrderedSet, fromJS } from 'immutable';

import {
  COMPOSE_MOUNT,
  COMPOSE_UNMOUNT,
  COMPOSE_CHANGE,
  COMPOSE_REPLY,
  COMPOSE_REPLY_CANCEL,
  COMPOSE_DIRECT,
  COMPOSE_MENTION,
  COMPOSE_SUBMIT_REQUEST,
  COMPOSE_SUBMIT_SUCCESS,
  COMPOSE_SUBMIT_FAIL,
  COMPOSE_UPLOAD_REQUEST,
  COMPOSE_UPLOAD_SUCCESS,
  COMPOSE_UPLOAD_FAIL,
  COMPOSE_UPLOAD_UNDO,
  COMPOSE_UPLOAD_PROGRESS,
  COMPOSE_UPLOAD_PROCESSING,
  THUMBNAIL_UPLOAD_REQUEST,
  THUMBNAIL_UPLOAD_SUCCESS,
  THUMBNAIL_UPLOAD_FAIL,
  THUMBNAIL_UPLOAD_PROGRESS,
  COMPOSE_SUGGESTIONS_CLEAR,
  COMPOSE_SUGGESTIONS_READY,
  COMPOSE_SUGGESTION_SELECT,
  COMPOSE_SUGGESTION_IGNORE,
  COMPOSE_SUGGESTION_TAGS_UPDATE,
  COMPOSE_TAG_HISTORY_UPDATE,
  COMPOSE_SENSITIVITY_CHANGE,
  COMPOSE_SPOILERNESS_CHANGE,
  COMPOSE_SPOILER_TEXT_CHANGE,
  COMPOSE_MARKDOWN_CHANGE,
  COMPOSE_VISIBILITY_CHANGE,
  COMPOSE_LANGUAGE_CHANGE,
  COMPOSE_COMPOSING_CHANGE,
  COMPOSE_EMOJI_INSERT,
  COMPOSE_EXPIRATION_INSERT,
  COMPOSE_REFERENCE_INSERT,
  COMPOSE_UPLOAD_CHANGE_REQUEST,
  COMPOSE_UPLOAD_CHANGE_SUCCESS,
  COMPOSE_UPLOAD_CHANGE_FAIL,
  COMPOSE_RESET,
  COMPOSE_POLL_ADD,
  COMPOSE_POLL_REMOVE,
  COMPOSE_POLL_OPTION_CHANGE,
  COMPOSE_POLL_SETTINGS_CHANGE,
  COMPOSE_CIRCLE_CHANGE,
  INIT_MEDIA_EDIT_MODAL,
  COMPOSE_CHANGE_MEDIA_DESCRIPTION,
  COMPOSE_CHANGE_MEDIA_FOCUS,
  COMPOSE_SET_STATUS,
  COMPOSE_SEARCHABILITY_CHANGE,
  COMPOSE_FOCUS,
} from '../actions/compose';
import { REDRAFT } from '../actions/statuses';
import { STORE_HYDRATE } from '../actions/store';
import { TIMELINE_DELETE } from '../actions/timelines';
import { enableLocalPrivacy, enableLoginPrivacy, enablePublicPrivacy, me } from '../initial_state';
import { unescapeHTML } from '../utils/html';
import { uuid } from '../uuid';

const initialState = ImmutableMap({
  mounted: 0,
  sensitive: false,
  spoiler: false,
  spoiler_text: '',
  markdown: false,
  privacy: null,
  circle_id: null,
  searchability: null,
  id: null,
  text: '',
  focusDate: null,
  caretPosition: null,
  preselectDate: null,
  in_reply_to: null,
  reply_to_limited: false,
  is_composing: false,
  is_submitting: false,
  is_changing_upload: false,
  is_uploading: false,
  progress: 0,
  isUploadingThumbnail: false,
  thumbnailProgress: 0,
  media_attachments: ImmutableList(),
  pending_media_attachments: 0,
  poll: null,
  suggestion_token: null,
  suggestions: ImmutableList(),
  default_privacy: 'public',
  stay_privacy: false,
  default_searchability: 'private',
  default_sensitive: false,
  default_language: 'en',
  resetFileKey: Math.floor((Math.random() * 0x10000)),
  idempotencyKey: null,
  tagHistory: ImmutableList(),
  media_modal: ImmutableMap({
    id: null,
    description: '',
    focusX: 0,
    focusY: 0,
    dirty: false,
  }),
  posted_on_this_session: false,
});

const initialPoll = ImmutableMap({
  options: ImmutableList(['', '']),
  expires_in: 24 * 3600,
  multiple: false,
});

function statusToTextMentions(state, status) {
  if (status.get('visibility_ex') === 'limited') {
    return '';
  }

  let set = ImmutableOrderedSet([]);

  if (status.getIn(['account', 'id']) !== me) {
    set = set.add(`@${status.getIn(['account', 'acct'])} `);
  }

  return set.union(status.get('mentions').filterNot(mention => mention.get('id') === me).map(mention => `@${mention.get('acct')} `)).join('');
}

function clearAll(state) {
  return state.withMutations(map => {
    map.set('text', '');
    map.set('spoiler', false);
    map.set('spoiler_text', '');
    map.set('markdown', false);
    map.set('is_submitting', false);
    map.set('is_changing_upload', false);
    if (!state.get('stay_privacy') || state.get('in_reply_to') || !state.get('posted_on_this_session') || state.get('id')) {
      map.set('privacy', state.get('default_privacy'));
      map.set('circle_id', null);
    }
    if (state.get('stay_privacy') && !state.get('in_reply_to')) {
      map.set('default_privacy', state.get('privacy'));
    }
    if ((map.get('privacy') === 'login' && !enableLoginPrivacy) || (map.get('privacy') === 'public_unlisted' && !enableLocalPrivacy)) {
      map.set('privacy', enablePublicPrivacy ? 'public' : 'unlisted');
    }
    if (!state.get('in_reply_to')) {
      map.set('posted_on_this_session', true);
    }
    map.set('reply_to_limited', false);
    map.set('limited_scope', null);
    map.set('id', null);
    map.set('in_reply_to', null);
    if (state.get('default_searchability') === 'public_unlisted' && !enableLocalPrivacy) {
      map.set('searchability', 'public');
    } else {
      map.set('searchability', state.get('default_searchability'));
    }
    map.set('sensitive', state.get('default_sensitive'));
    map.set('language', state.get('default_language'));
    map.update('media_attachments', list => list.clear());
    map.set('poll', null);
    map.set('idempotencyKey', uuid());
  });
}

function appendMedia(state, media, file) {
  const prevSize = state.get('media_attachments').size;

  return state.withMutations(map => {
    if (media.get('type') === 'image') {
      media = media.set('file', file);
    }
    map.update('media_attachments', list => list.push(media.set('unattached', true)));
    map.set('is_uploading', false);
    map.set('is_processing', false);
    map.set('resetFileKey', Math.floor((Math.random() * 0x10000)));
    map.set('idempotencyKey', uuid());
    map.update('pending_media_attachments', n => n - 1);

    if (prevSize === 0 && (state.get('default_sensitive') || state.get('spoiler'))) {
      map.set('sensitive', true);
    }
  });
}

function removeMedia(state, mediaId) {
  const prevSize = state.get('media_attachments').size;

  return state.withMutations(map => {
    map.update('media_attachments', list => list.filterNot(item => item.get('id') === mediaId));
    map.set('idempotencyKey', uuid());

    if (prevSize === 1) {
      map.set('sensitive', false);
    }
  });
}

const insertSuggestion = (state, position, token, completion, path) => {
  return state.withMutations(map => {
    map.updateIn(path, oldText => `${oldText.slice(0, position)}${completion} ${oldText.slice(position + token.length)}`);
    map.set('suggestion_token', null);
    map.set('suggestions', ImmutableList());
    if (path.length === 1 && path[0] === 'text') {
      map.set('focusDate', new Date());
      map.set('caretPosition', position + completion.length + 1);
    }
    map.set('idempotencyKey', uuid());
  });
};

const ignoreSuggestion = (state, position, token, completion, path) => {
  return state.withMutations(map => {
    map.updateIn(path, oldText => `${oldText.slice(0, position + token.length)} ${oldText.slice(position + token.length)}`);
    map.set('suggestion_token', null);
    map.set('suggestions', ImmutableList());
    map.set('focusDate', new Date());
    map.set('caretPosition', position + token.length + 1);
    map.set('idempotencyKey', uuid());
  });
};

const sortHashtagsByUse = (state, tags) => {
  const personalHistory = state.get('tagHistory').map(tag => tag.toLowerCase());

  const tagsWithLowercase = tags.map(t => ({ ...t, lowerName: t.name.toLowerCase() }));
  const sorted = tagsWithLowercase.sort((a, b) => {
    const usedA = personalHistory.includes(a.lowerName);
    const usedB = personalHistory.includes(b.lowerName);

    if (usedA === usedB) {
      return 0;
    } else if (usedA && !usedB) {
      return -1;
    } else {
      return 1;
    }
  });
  sorted.forEach(tag => delete tag.lowerName);
  return sorted;
};

const insertEmoji = (state, position, emojiData, needsSpace) => {
  const oldText = state.get('text');
  const emoji = needsSpace ? ' ' + emojiData.native : emojiData.native;

  return state.merge({
    text: `${oldText.slice(0, position)}${emoji} ${oldText.slice(position)}`,
    focusDate: new Date(),
    caretPosition: position + emoji.length + 1,
    idempotencyKey: uuid(),
  });
};

const insertExpiration = (state, position, data) => {
  const oldText = state.get('text');

  return state.merge({
    text: `${oldText.slice(0, position)} ${data} ${oldText.slice(position)}`,
    focusDate: new Date(),
    caretPosition: position + data.length + 2,
    idempotencyKey: uuid(),
  });
};

const insertReference = (state, url, attributeType) => {
  const oldText = state.get('text');
  const attribute = attributeType || 'BT';

  if (oldText.indexOf(`${attribute} ${url}`) >= 0) {
    return state;
  }

  let newLine = '\n\n';
  if (oldText.length === 0) newLine = '';
  else if (oldText[oldText.length - 1] === '\n') {
    if (oldText.length === 1 || oldText[oldText.length - 2] === '\n') {
      newLine = '';
    } else {
      newLine = '\n';
    }
  }

  if (oldText.length > 0) {
    const lastLine = oldText.slice(oldText.lastIndexOf('\n') + 1, oldText.length - 1);
    if (lastLine.startsWith(`${attribute} `)) {
      newLine = '\n';
    }
  }

  const referenceText = `${newLine}${attribute} ${url}`;
  const text = `${oldText}${referenceText}`;

  return state.merge({
    text,
    focusDate: new Date(),
    caretPosition: text.length - referenceText.length,
    idempotencyKey: uuid(),
  });
};

const privacyPreference = (a, b) => {
  const order = ['public', 'public_unlisted', 'unlisted', 'login', 'private', 'direct'];
  return order[Math.max(order.indexOf(a), order.indexOf(b), 0)];
};

const hydrate = (state, hydratedState) => {
  state = clearAll(state.merge(hydratedState));

  if (hydratedState.get('text')) {
    state = state.set('text', hydratedState.get('text')).set('focusDate', new Date());
  }

  return state;
};

const domParser = new DOMParser();

const expandMentions = status => {
  const fragment = domParser.parseFromString(status.get('content'), 'text/html').documentElement;

  status.get('mentions').forEach(mention => {
    fragment.querySelector(`a[href="${mention.get('url')}"]`).textContent = `@${mention.get('acct')}`;
  });

  return fragment.innerHTML;
};

const expiresInFromExpiresAt = expires_at => {
  if (!expires_at) return 24 * 3600;
  const delta = (new Date(expires_at).getTime() - Date.now()) / 1000;
  return [300, 1800, 3600, 21600, 86400, 259200, 604800].find(expires_in => expires_in >= delta) || 24 * 3600;
};

const mergeLocalHashtagResults = (suggestions, prefix, tagHistory) => {
  prefix = prefix.toLowerCase();
  if (suggestions.length < 4) {
    const localTags = tagHistory.filter(tag => tag.toLowerCase().startsWith(prefix) && !suggestions.some(suggestion => suggestion.type === 'hashtag' && suggestion.name.toLowerCase() === tag.toLowerCase()));
    return suggestions.concat(localTags.slice(0, 4 - suggestions.length).toJS().map(tag => ({ type: 'hashtag', name: tag })));
  } else {
    return suggestions;
  }
};

const normalizeSuggestions = (state, { accounts, emojis, tags, token }) => {
  if (accounts) {
    return accounts.map(item => ({ id: item.id, type: 'account' }));
  } else if (emojis) {
    return emojis.map(item => ({ ...item, type: 'emoji' }));
  } else {
    return mergeLocalHashtagResults(sortHashtagsByUse(state, tags.map(item => ({ ...item, type: 'hashtag' }))), token.slice(1), state.get('tagHistory'));
  }
};

const updateSuggestionTags = (state, token) => {
  const prefix = token.slice(1);

  const suggestions = state.get('suggestions').toJS();
  return state.merge({
    suggestions: ImmutableList(mergeLocalHashtagResults(suggestions, prefix, state.get('tagHistory'))),
    suggestion_token: token,
  });
};

const updatePoll = (state, index, value, maxOptions) => state.updateIn(['poll', 'options'], options => {
  const tmp = options.set(index, value).filterNot(x => x.trim().length === 0);

  if (tmp.size === 0) {
    return tmp.push('').push('');
  } else if (tmp.size < maxOptions) {
    return tmp.push('');
  }

  return tmp;
});

export default function compose(state = initialState, action) {
  switch(action.type) {
  case STORE_HYDRATE:
    return hydrate(state, action.state.get('compose'));
  case COMPOSE_MOUNT:
    return state.set('mounted', state.get('mounted') + 1);
  case COMPOSE_UNMOUNT:
    return state
      .set('mounted', Math.max(state.get('mounted') - 1, 0))
      .set('is_composing', false);
  case COMPOSE_SENSITIVITY_CHANGE:
    return state.withMutations(map => {
      if (!state.get('spoiler')) {
        map.set('sensitive', !state.get('sensitive'));
      }

      map.set('idempotencyKey', uuid());
    });
  case COMPOSE_SPOILERNESS_CHANGE:
    return state.withMutations(map => {
      map.set('spoiler', !state.get('spoiler'));
      map.set('idempotencyKey', uuid());

      if (state.get('media_attachments').size >= 1 && !state.get('default_sensitive')) {
        map.set('sensitive', !state.get('spoiler'));
      }
    });
  case COMPOSE_SPOILER_TEXT_CHANGE:
    if (!state.get('spoiler')) return state;
    return state
      .set('spoiler_text', action.text)
      .set('idempotencyKey', uuid());
  case COMPOSE_MARKDOWN_CHANGE:
    return state.withMutations(map => {
      map.set('markdown', !state.get('markdown'));
      map.set('idempotencyKey', uuid());
    });
  case COMPOSE_VISIBILITY_CHANGE:
    return state
      .set('privacy', action.value)
      .set('idempotencyKey', uuid());
  case COMPOSE_SEARCHABILITY_CHANGE:
    return state
      .set('searchability', action.value)
      .set('idempotencyKey', uuid());
  case COMPOSE_CHANGE:
    return state
      .set('text', action.text)
      .set('idempotencyKey', uuid());
  case COMPOSE_COMPOSING_CHANGE:
    return state.set('is_composing', action.value);
  case COMPOSE_REPLY:
    return state.withMutations(map => {
      map.set('id', null);
      map.set('in_reply_to', action.status.get('id'));
      map.set('text', statusToTextMentions(state, action.status));
      map.set('reply_to_limited', action.status.get('visibility_ex') === 'limited');
      if (action.status.get('visibility_ex') === 'limited') {
        map.set('privacy', 'reply');
      } else {
        map.set('privacy', privacyPreference(action.status.get('visibility_ex'), state.get('default_privacy')));
      }
      map.set('limited_scope', null);
      map.set('searchability', privacyPreference(action.status.get('searchability'), state.get('default_searchability')));
      map.set('focusDate', new Date());
      map.set('caretPosition', null);
      map.set('preselectDate', new Date());
      map.set('idempotencyKey', uuid());

      map.update('media_attachments', list => list.filter(media => media.get('unattached')));

      if (action.status.get('language') && !action.status.has('translation')) {
        map.set('language', action.status.get('language'));
      } else {
        map.set('language', state.get('default_language'));
      }

      if (action.status.get('spoiler_text').length > 0) {
        map.set('spoiler', true);
        map.set('spoiler_text', action.status.get('spoiler_text'));

        if (map.get('media_attachments').size >= 1) {
          map.set('sensitive', true);
        }
      } else {
        map.set('spoiler', false);
        map.set('spoiler_text', '');
      }
    });
  case COMPOSE_SUBMIT_REQUEST:
    return state.set('is_submitting', true);
  case COMPOSE_UPLOAD_CHANGE_REQUEST:
    return state.set('is_changing_upload', true);
  case COMPOSE_REPLY_CANCEL:
  case COMPOSE_RESET:
  case COMPOSE_SUBMIT_SUCCESS:
    return clearAll(state);
  case COMPOSE_SUBMIT_FAIL:
    return state.set('is_submitting', false);
  case COMPOSE_UPLOAD_CHANGE_FAIL:
    return state.set('is_changing_upload', false);
  case COMPOSE_UPLOAD_REQUEST:
    return state.set('is_uploading', true).update('pending_media_attachments', n => n + 1);
  case COMPOSE_UPLOAD_PROCESSING:
    return state.set('is_processing', true);
  case COMPOSE_UPLOAD_SUCCESS:
    return appendMedia(state, fromJS(action.media), action.file);
  case COMPOSE_UPLOAD_FAIL:
    return state.set('is_uploading', false).set('is_processing', false).update('pending_media_attachments', n => n - 1);
  case COMPOSE_UPLOAD_UNDO:
    return removeMedia(state, action.media_id);
  case COMPOSE_UPLOAD_PROGRESS:
    return state.set('progress', Math.round((action.loaded / action.total) * 100));
  case THUMBNAIL_UPLOAD_REQUEST:
    return state.set('isUploadingThumbnail', true);
  case THUMBNAIL_UPLOAD_PROGRESS:
    return state.set('thumbnailProgress', Math.round((action.loaded / action.total) * 100));
  case THUMBNAIL_UPLOAD_FAIL:
    return state.set('isUploadingThumbnail', false);
  case THUMBNAIL_UPLOAD_SUCCESS:
    return state
      .set('isUploadingThumbnail', false)
      .update('media_attachments', list => list.map(item => {
        if (item.get('id') === action.media.id) {
          return fromJS(action.media);
        }

        return item;
      }));
  case INIT_MEDIA_EDIT_MODAL:
    const media =  state.get('media_attachments').find(item => item.get('id') === action.id);
    return state.set('media_modal', ImmutableMap({
      id: action.id,
      description: media.get('description') || '',
      focusX: media.getIn(['meta', 'focus', 'x'], 0),
      focusY: media.getIn(['meta', 'focus', 'y'], 0),
      dirty: false,
    }));
  case COMPOSE_CHANGE_MEDIA_DESCRIPTION:
    return state.setIn(['media_modal', 'description'], action.description).setIn(['media_modal', 'dirty'], true);
  case COMPOSE_CHANGE_MEDIA_FOCUS:
    return state.setIn(['media_modal', 'focusX'], action.focusX).setIn(['media_modal', 'focusY'], action.focusY).setIn(['media_modal', 'dirty'], true);
  case COMPOSE_MENTION:
    return state.withMutations(map => {
      map.update('text', text => [text.trim(), `@${action.account.get('acct')} `].filter((str) => str.length !== 0).join(' '));
      map.set('focusDate', new Date());
      map.set('caretPosition', null);
      map.set('idempotencyKey', uuid());
    });
  case COMPOSE_DIRECT:
    return state.withMutations(map => {
      map.update('text', text => [text.trim(), `@${action.account.get('acct')} `].filter((str) => str.length !== 0).join(' '));
      map.set('privacy', 'direct');
      map.set('focusDate', new Date());
      map.set('caretPosition', null);
      map.set('idempotencyKey', uuid());
    });
  case COMPOSE_SUGGESTIONS_CLEAR:
    return state.update('suggestions', ImmutableList(), list => list.clear()).set('suggestion_token', null);
  case COMPOSE_SUGGESTIONS_READY:
    return state.set('suggestions', ImmutableList(normalizeSuggestions(state, action))).set('suggestion_token', action.token);
  case COMPOSE_SUGGESTION_SELECT:
    return insertSuggestion(state, action.position, action.token, action.completion, action.path);
  case COMPOSE_SUGGESTION_IGNORE:
    return ignoreSuggestion(state, action.position, action.token, action.completion, action.path);
  case COMPOSE_SUGGESTION_TAGS_UPDATE:
    return updateSuggestionTags(state, action.token);
  case COMPOSE_TAG_HISTORY_UPDATE:
    return state.set('tagHistory', fromJS(action.tags));
  case TIMELINE_DELETE:
    if (action.id === state.get('in_reply_to')) {
      if (state.get('privacy') === 'reply') {
        return state.set('in_reply_to', null).set('privacy', 'circle');
      } else {
        return state.set('in_reply_to', null);
      }
    } else if (action.id === state.get('id')) {
      return state.set('id', null);
    } else {
      return state;
    }
  case COMPOSE_EMOJI_INSERT:
    return insertEmoji(state, action.position, action.emoji, action.needsSpace);
  case COMPOSE_EXPIRATION_INSERT:
    return insertExpiration(state, action.position, action.data);
  case COMPOSE_REFERENCE_INSERT:
    return insertReference(state, action.url, action.attributeType);
  case COMPOSE_UPLOAD_CHANGE_SUCCESS:
    return state
      .set('is_changing_upload', false)
      .setIn(['media_modal', 'dirty'], false)
      .update('media_attachments', list => list.map(item => {
        if (item.get('id') === action.media.id) {
          return fromJS(action.media).set('unattached', !action.attached);
        }

        return item;
      }));
  case REDRAFT:
    return state.withMutations(map => {
      map.set('text', action.raw_text || unescapeHTML(expandMentions(action.status)));
      map.set('in_reply_to', action.status.get('in_reply_to_id'));
      map.set('privacy', action.status.get('visibility_ex'));
      map.set('reply_to_limited', action.status.get('limited_scope') === 'reply');
      map.set('limited_scope', null);
      map.set('media_attachments', action.status.get('media_attachments').map((media) => media.set('unattached', true)));
      map.set('focusDate', new Date());
      map.set('caretPosition', null);
      map.set('idempotencyKey', uuid());
      map.set('sensitive', action.status.get('sensitive'));
      map.set('language', action.status.get('language'));
      map.set('markdown', action.status.get('markdown'));
      map.set('id', null);

      if (action.status.get('spoiler_text').length > 0) {
        map.set('spoiler', true);
        map.set('spoiler_text', action.status.get('spoiler_text'));
      } else {
        map.set('spoiler', false);
        map.set('spoiler_text', '');
      }

      if (action.status.get('poll')) {
        map.set('poll', ImmutableMap({
          options: action.status.getIn(['poll', 'options']).map(x => x.get('title')),
          multiple: action.status.getIn(['poll', 'multiple']),
          expires_in: expiresInFromExpiresAt(action.status.getIn(['poll', 'expires_at'])),
        }));
      }
    });
  case COMPOSE_SET_STATUS:
    return state.withMutations(map => {
      map.set('id', action.status.get('id'));
      map.set('text', action.text);
      map.set('in_reply_to', action.status.get('in_reply_to_id'));
      if (action.status.get('visibility_ex') !== 'limited') {
        map.set('privacy', action.status.get('visibility_ex'));
      } else {
        map.set('privacy', action.status.get('limited_scope') || 'circle');
      }
      map.set('reply_to_limited', action.status.get('limited_scope') === 'reply');
      map.set('limited_scope', action.status.get('limited_scope'));
      map.set('media_attachments', action.status.get('media_attachments'));
      map.set('focusDate', new Date());
      map.set('caretPosition', null);
      map.set('idempotencyKey', uuid());
      map.set('sensitive', action.status.get('sensitive'));
      map.set('language', action.status.get('language'));
      map.set('markdown', action.status.get('markdown'));

      if (action.spoiler_text.length > 0) {
        map.set('spoiler', true);
        map.set('spoiler_text', action.spoiler_text);
      } else {
        map.set('spoiler', false);
        map.set('spoiler_text', '');
      }

      if (action.status.get('poll')) {
        map.set('poll', ImmutableMap({
          options: action.status.getIn(['poll', 'options']).map(x => x.get('title')),
          multiple: action.status.getIn(['poll', 'multiple']),
          expires_in: expiresInFromExpiresAt(action.status.getIn(['poll', 'expires_at'])),
        }));
      }
    });
  case COMPOSE_POLL_ADD:
    return state.set('poll', initialPoll);
  case COMPOSE_POLL_REMOVE:
    return state.set('poll', null);
  case COMPOSE_POLL_OPTION_CHANGE:
    return updatePoll(state, action.index, action.title, action.maxOptions);
  case COMPOSE_POLL_SETTINGS_CHANGE:
    return state.update('poll', poll => poll.set('expires_in', action.expiresIn).set('multiple', action.isMultiple));
  case COMPOSE_CIRCLE_CHANGE:
    return state.set('circle_id', action.circleId);
  case COMPOSE_LANGUAGE_CHANGE:
    return state.set('language', action.language);
  case COMPOSE_FOCUS:
    return state.set('focusDate', new Date()).update('text', text => text.length > 0 ? text : action.defaultText);
  default:
    return state;
  }
}
