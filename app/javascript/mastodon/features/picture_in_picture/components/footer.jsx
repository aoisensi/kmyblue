import PropTypes from 'prop-types';

import { defineMessages, injectIntl } from 'react-intl';

import classNames from 'classnames';
import { withRouter } from 'react-router-dom';

import ImmutablePropTypes from 'react-immutable-proptypes';
import ImmutablePureComponent from 'react-immutable-pure-component';
import { connect } from 'react-redux';

import OpenInNewIcon from '@/material-icons/400-24px/open_in_new.svg?react';
import RepeatIcon from '@/material-icons/400-24px/repeat.svg?react';
import ReplyIcon from '@/material-icons/400-24px/reply.svg?react';
import ReplyAllIcon from '@/material-icons/400-24px/reply_all.svg?react';
import StarIcon from '@/material-icons/400-24px/star.svg?react';
import { initBoostModal } from 'mastodon/actions/boosts';
import { replyCompose } from 'mastodon/actions/compose';
import { reblog, favourite, unreblog, unfavourite } from 'mastodon/actions/interactions';
import { openModal } from 'mastodon/actions/modal';
import { IconButton } from 'mastodon/components/icon_button';
import { me, boostModal } from 'mastodon/initial_state';
import { makeGetStatus } from 'mastodon/selectors';
import { WithRouterPropTypes } from 'mastodon/utils/react_router';

const messages = defineMessages({
  reply: { id: 'status.reply', defaultMessage: 'Reply' },
  replyAll: { id: 'status.replyAll', defaultMessage: 'Reply to thread' },
  reblog: { id: 'status.reblog', defaultMessage: 'Boost' },
  reblog_private: { id: 'status.reblog_private', defaultMessage: 'Boost with original visibility' },
  cancel_reblog_private: { id: 'status.cancel_reblog_private', defaultMessage: 'Unboost' },
  cannot_reblog: { id: 'status.cannot_reblog', defaultMessage: 'This post cannot be boosted' },
  favourite: { id: 'status.favourite', defaultMessage: 'Favorite' },
  replyConfirm: { id: 'confirmations.reply.confirm', defaultMessage: 'Reply' },
  replyMessage: { id: 'confirmations.reply.message', defaultMessage: 'Replying now will overwrite the message you are currently composing. Are you sure you want to proceed?' },
  open: { id: 'status.open', defaultMessage: 'Expand this status' },
});

const makeMapStateToProps = () => {
  const getStatus = makeGetStatus();

  const mapStateToProps = (state, { statusId }) => ({
    status: getStatus(state, { id: statusId }),
    askReplyConfirmation: state.getIn(['compose', 'text']).trim().length !== 0,
  });

  return mapStateToProps;
};

class Footer extends ImmutablePureComponent {

  static contextTypes = {
    identity: PropTypes.object,
  };

  static propTypes = {
    statusId: PropTypes.string.isRequired,
    status: ImmutablePropTypes.map.isRequired,
    intl: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    askReplyConfirmation: PropTypes.bool,
    withOpenButton: PropTypes.bool,
    onClose: PropTypes.func,
    ...WithRouterPropTypes,
  };

  _performReply = () => {
    const { dispatch, status, onClose, history } = this.props;

    if (onClose) {
      onClose(true);
    }

    dispatch(replyCompose(status, history));
  };

  handleReplyClick = () => {
    const { dispatch, askReplyConfirmation, status, intl } = this.props;
    const { signedIn } = this.context.identity;

    if (signedIn) {
      if (askReplyConfirmation) {
        dispatch(openModal({
          modalType: 'CONFIRM',
          modalProps: {
            message: intl.formatMessage(messages.replyMessage),
            confirm: intl.formatMessage(messages.replyConfirm),
            onConfirm: this._performReply,
          },
        }));
      } else {
        this._performReply();
      }
    } else {
      dispatch(openModal({
        modalType: 'INTERACTION',
        modalProps: {
          type: 'reply',
          accountId: status.getIn(['account', 'id']),
          url: status.get('uri'),
        },
      }));
    }
  };

  handleFavouriteClick = () => {
    const { dispatch, status } = this.props;
    const { signedIn } = this.context.identity;

    if (signedIn) {
      if (status.get('favourited')) {
        dispatch(unfavourite(status));
      } else {
        dispatch(favourite(status));
      }
    } else {
      dispatch(openModal({
        modalType: 'INTERACTION',
        modalProps: {
          type: 'favourite',
          accountId: status.getIn(['account', 'id']),
          url: status.get('uri'),
        },
      }));
    }
  };

  _performReblog = (status, privacy) => {
    const { dispatch } = this.props;
    dispatch(reblog(status, privacy));
  };

  handleReblogClick = e => {
    const { dispatch, status } = this.props;
    const { signedIn } = this.context.identity;

    if (signedIn) {
      if (status.get('reblogged')) {
        dispatch(unreblog(status));
      } else if ((e && e.shiftKey) || !boostModal) {
        this._performReblog(status);
      } else {
        dispatch(initBoostModal({ status, onReblog: this._performReblog }));
      }
    } else {
      dispatch(openModal({
        modalType: 'INTERACTION',
        modalProps: {
          type: 'reblog',
          accountId: status.getIn(['account', 'id']),
          url: status.get('uri'),
        },
      }));
    }
  };

  handleOpenClick = e => {
    const { status, onClose, history } = this.props;

    if (e.button !== 0 || !history) {
      return;
    }

    if (onClose) {
      onClose();
    }

    this.props.history.push(`/@${status.getIn(['account', 'acct'])}/${status.get('id')}`);
  };

  render () {
    const { status, intl, withOpenButton } = this.props;

    const publicStatus  = ['public', 'unlisted', 'public_unlisted', 'login'].includes(status.get('visibility_ex'));
    const reblogPrivate = status.getIn(['account', 'id']) === me && status.get('visibility_ex') === 'private';

    let replyIcon, replyIconComponent, replyTitle;

    if (status.get('in_reply_to_id', null) === null) {
      replyIcon = 'reply';
      replyIconComponent = ReplyIcon;
      replyTitle = intl.formatMessage(messages.reply);
    } else {
      replyIcon = 'reply-all';
      replyIconComponent = ReplyAllIcon;
      replyTitle = intl.formatMessage(messages.replyAll);
    }

    let reblogTitle = '';

    if (status.get('reblogged')) {
      reblogTitle = intl.formatMessage(messages.cancel_reblog_private);
    } else if (publicStatus) {
      reblogTitle = intl.formatMessage(messages.reblog);
    } else if (reblogPrivate) {
      reblogTitle = intl.formatMessage(messages.reblog_private);
    } else {
      reblogTitle = intl.formatMessage(messages.cannot_reblog);
    }

    return (
      <div className='picture-in-picture__footer'>
        <IconButton className='status__action-bar-button' title={replyTitle} icon={status.get('in_reply_to_account_id') === status.getIn(['account', 'id']) ? 'reply' : replyIcon} iconComponent={status.get('in_reply_to_account_id') === status.getIn(['account', 'id']) ? ReplyIcon : replyIconComponent} onClick={this.handleReplyClick} counter={status.get('replies_count')} />
        <IconButton className={classNames('status__action-bar-button', { reblogPrivate })} disabled={!publicStatus && !reblogPrivate}  active={status.get('reblogged')} title={reblogTitle} icon='retweet' iconComponent={RepeatIcon} onClick={this.handleReblogClick} counter={status.get('reblogs_count')} />
        <IconButton className='status__action-bar-button star-icon' animate active={status.get('favourited')} title={intl.formatMessage(messages.favourite)} icon='star' iconComponent={StarIcon} onClick={this.handleFavouriteClick} counter={status.get('favourites_count')} />
        {withOpenButton && <IconButton className='status__action-bar-button' title={intl.formatMessage(messages.open)} icon='external-link' iconComponent={OpenInNewIcon} onClick={this.handleOpenClick} href={`/@${status.getIn(['account', 'acct'])}/${status.get('id')}`} />}
      </div>
    );
  }

}

export default  withRouter(connect(makeMapStateToProps)(injectIntl(Footer)));
