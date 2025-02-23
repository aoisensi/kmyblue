import PropTypes from 'prop-types';

import { defineMessages, injectIntl, FormattedMessage } from 'react-intl';

import classNames from 'classnames';
import { withRouter } from 'react-router-dom';

import ImmutablePropTypes from 'react-immutable-proptypes';
import ImmutablePureComponent from 'react-immutable-pure-component';
import { connect } from 'react-redux';

import RepeatIcon from '@/material-icons/400-24px/repeat.svg?react';
import { changeBoostPrivacy } from 'mastodon/actions/boosts';
import AttachmentList from 'mastodon/components/attachment_list';
import { Icon }  from 'mastodon/components/icon';
import { VisibilityIcon } from 'mastodon/components/visibility_icon';
import PrivacyDropdown from 'mastodon/features/compose/components/privacy_dropdown';
import { WithRouterPropTypes } from 'mastodon/utils/react_router';

import { Avatar } from '../../../components/avatar';
import { Button } from '../../../components/button';
import { DisplayName } from '../../../components/display_name';
import { RelativeTimestamp } from '../../../components/relative_timestamp';
import StatusContent from '../../../components/status_content';

const messages = defineMessages({
  cancel_reblog: { id: 'status.cancel_reblog_private', defaultMessage: 'Unboost' },
  reblog: { id: 'status.reblog', defaultMessage: 'Boost' },
});

const mapStateToProps = state => {
  return {
    privacy: state.getIn(['boosts', 'new', 'privacy']),
  };
};

const mapDispatchToProps = dispatch => {
  return {
    onChangeBoostPrivacy(value) {
      dispatch(changeBoostPrivacy(value));
    },
  };
};

class BoostModal extends ImmutablePureComponent {
  static propTypes = {
    status: ImmutablePropTypes.map.isRequired,
    onReblog: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    onChangeBoostPrivacy: PropTypes.func.isRequired,
    privacy: PropTypes.string.isRequired,
    intl: PropTypes.object.isRequired,
    ...WithRouterPropTypes,
  };

  handleReblog = () => {
    this.props.onReblog(this.props.status, this.props.privacy);
    this.props.onClose();
  };

  handleAccountClick = (e) => {
    if (e.button === 0 && !(e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.props.onClose();
      this.props.history.push(`/@${this.props.status.getIn(['account', 'acct'])}`);
    }
  };

  _findContainer = () => {
    return document.getElementsByClassName('modal-root__container')[0];
  };

  render () {
    const { status, privacy, intl } = this.props;
    const buttonText = status.get('reblogged') ? messages.cancel_reblog : messages.reblog;

    return (
      <div className='modal-root__modal boost-modal'>
        <div className='boost-modal__container'>
          <div className={classNames('status', `status-${status.get('visibility_ex')}`, 'light')}>
            <div className='status__info'>
              <a href={`/@${status.getIn(['account', 'acct'])}/${status.get('id')}`} className='status__relative-time' target='_blank' rel='noopener noreferrer'>
                <span className='status__visibility-icon'><VisibilityIcon visibility={status.get('limited_scope') || status.get('visibility_ex')} /></span>
                <RelativeTimestamp timestamp={status.get('created_at')} />
              </a>

              <a onClick={this.handleAccountClick} href={`/@${status.getIn(['account', 'acct'])}`} className='status__display-name'>
                <div className='status__avatar'>
                  <Avatar account={status.get('account')} size={48} />
                </div>

                <DisplayName account={status.get('account')} />
              </a>
            </div>

            <StatusContent status={status} />

            {status.get('media_attachments').size > 0 && (
              <AttachmentList
                compact
                media={status.get('media_attachments')}
              />
            )}
          </div>
        </div>

        <div className='boost-modal__action-bar'>
          <div><FormattedMessage id='boost_modal.combo' defaultMessage='You can press {combo} to skip this next time' values={{ combo: <span>Shift + <Icon id='retweet' icon={RepeatIcon} /></span> }} /></div>
          {status.get('visibility') !== 'private' && !status.get('reblogged') && (
            <PrivacyDropdown
              noDirect
              noLimited
              value={privacy}
              container={this._findContainer}
              onChange={this.props.onChangeBoostPrivacy}
            />
          )}
          <Button text={intl.formatMessage(buttonText)} onClick={this.handleReblog} autoFocus />
        </div>
      </div>
    );
  }

}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(injectIntl(BoostModal)));
