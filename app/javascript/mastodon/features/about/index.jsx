import PropTypes from 'prop-types';
import { PureComponent } from 'react';

import { defineMessages, injectIntl, FormattedMessage } from 'react-intl';

import classNames from 'classnames';
import { Helmet } from 'react-helmet';

import { List as ImmutableList } from 'immutable';
import ImmutablePropTypes from 'react-immutable-proptypes';
import { connect } from 'react-redux';

import ChevronRightIcon from '@/material-icons/400-24px/chevron_right.svg?react';
import DisabledIcon from '@/material-icons/400-24px/close-fill.svg?react';
import EnabledIcon from '@/material-icons/400-24px/done-fill.svg?react';
import ExpandMoreIcon from '@/material-icons/400-24px/expand_more.svg?react';
import { fetchServer, fetchExtendedDescription, fetchDomainBlocks  } from 'mastodon/actions/server';
import Column from 'mastodon/components/column';
import { Icon  }  from 'mastodon/components/icon';
import { ServerHeroImage } from 'mastodon/components/server_hero_image';
import { Skeleton } from 'mastodon/components/skeleton';
import Account from 'mastodon/containers/account_container';
import LinkFooter from 'mastodon/features/ui/components/link_footer';

const messages = defineMessages({
  title: { id: 'column.about', defaultMessage: 'About' },
  rules: { id: 'about.rules', defaultMessage: 'Server rules' },
  blocks: { id: 'about.blocks', defaultMessage: 'Moderated servers' },
  fullTextSearch: { id: 'about.full_text_search', defaultMessage: 'Full text search' },
  localTimeline: { id: 'column.community', defaultMessage: 'Local timeline' },
  noop: { id: 'about.domain_blocks.noop.title', defaultMessage: 'Soft limited' },
  noopExplanation: { id: 'about.domain_blocks.noop.explanation', defaultMessage: 'This server is limited partically.' },
  silenced: { id: 'about.domain_blocks.silenced.title', defaultMessage: 'Limited' },
  silencedExplanation: { id: 'about.domain_blocks.silenced.explanation', defaultMessage: 'You will generally not see profiles and content from this server, unless you explicitly look it up or opt into it by following.' },
  suspended: { id: 'about.domain_blocks.suspended.title', defaultMessage: 'Suspended' },
  suspendedExplanation: { id: 'about.domain_blocks.suspended.explanation', defaultMessage: 'No data from this server will be processed, stored or exchanged, making any interaction or communication with users from this server impossible.' },
  publicUnlistedVisibility: { id: 'privacy.public_unlisted.short', defaultMessage: 'Public unlisted' },
  publicVisibility: { id: 'about.public_visibility', defaultMessage: 'Public visibility' },
  emojiReaction: { id: 'status.emoji_reaction', defaultMessage: 'Emoji reaction' },
  enabled: { id: 'about.enabled', defaultMessage: 'Enabled' },
  disabled: { id: 'about.disabled', defaultMessage: 'Disabled' },
  capabilities: { id: 'about.kmyblue_capabilities', defaultMessage: 'kmyblue capabilities' },
});

const severityMessages = {
  silence: {
    title: messages.silenced,
    explanation: messages.silencedExplanation,
  },

  suspend: {
    title: messages.suspended,
    explanation: messages.suspendedExplanation,
  },

  noop: {
    title: messages.noop,
    explanation: messages.noopExplanation,
  },
};

const mapStateToProps = state => ({
  server: state.getIn(['server', 'server']),
  extendedDescription: state.getIn(['server', 'extendedDescription']),
  domainBlocks: state.getIn(['server', 'domainBlocks']),
});

class Section extends PureComponent {

  static propTypes = {
    title: PropTypes.string,
    children: PropTypes.node,
    open: PropTypes.bool,
    onOpen: PropTypes.func,
  };

  state = {
    collapsed: !this.props.open,
  };

  handleClick = () => {
    const { onOpen } = this.props;
    const { collapsed } = this.state;

    this.setState({ collapsed: !collapsed }, () => onOpen && onOpen());
  };

  render () {
    const { title, children } = this.props;
    const { collapsed } = this.state;

    return (
      <div className={classNames('about__section', { active: !collapsed })}>
        <div className='about__section__title' role='button' tabIndex={0} onClick={this.handleClick}>
          <Icon id={collapsed ? 'chevron-right' : 'chevron-down'} icon={collapsed ? ChevronRightIcon : ExpandMoreIcon} /> {title}
        </div>

        {!collapsed && (
          <div className='about__section__body'>{children}</div>
        )}
      </div>
    );
  }

}

class CapabilityIcon extends PureComponent {

  static propTypes = {
    intl: PropTypes.object.isRequired,
    state: PropTypes.bool,
  };

  render () {
    const { intl, state } = this.props;

    if (state) {
      return (
        <span className='capability-icon enabled'><Icon id='check' icon={EnabledIcon} title={intl.formatMessage(messages.enabled)} />{intl.formatMessage(messages.enabled)}</span>
      );
    } else {
      return (
        <span className='capability-icon disabled'><Icon id='times' icon={DisabledIcon} title={intl.formatMessage(messages.disabled)} />{intl.formatMessage(messages.disabled)}</span>
      );
    }
  }
}

class About extends PureComponent {

  static propTypes = {
    server: ImmutablePropTypes.map,
    extendedDescription: ImmutablePropTypes.map,
    domainBlocks: ImmutablePropTypes.contains({
      isLoading: PropTypes.bool,
      isAvailable: PropTypes.bool,
      items: ImmutablePropTypes.list,
    }),
    dispatch: PropTypes.func.isRequired,
    intl: PropTypes.object.isRequired,
    multiColumn: PropTypes.bool,
  };

  componentDidMount () {
    const { dispatch } = this.props;
    dispatch(fetchServer());
    dispatch(fetchExtendedDescription());
  }

  handleDomainBlocksOpen = () => {
    const { dispatch } = this.props;
    dispatch(fetchDomainBlocks());
  };

  render () {
    const { multiColumn, intl, server, extendedDescription, domainBlocks } = this.props;
    const isLoading = server.get('isLoading');

    const fedibirdCapabilities = server.get('fedibird_capabilities') || [];   // thinking about isLoading is true
    const isPublicUnlistedVisibility = fedibirdCapabilities.includes('kmyblue_visibility_public_unlisted');
    const isPublicVisibility = !fedibirdCapabilities.includes('kmyblue_no_public_visibility');
    const isEmojiReaction = fedibirdCapabilities.includes('emoji_reaction');
    const isLocalTimeline = !fedibirdCapabilities.includes('timeline_no_local');

    const isFullTextSearch = server.getIn(['configuration', 'search', 'enabled']);

    const email = server.getIn(['contact', 'email']) || '';
    const emailLink = email.startsWith('https://') ? email : `mailto:${email}`;

    return (
      <Column bindToDocument={!multiColumn} label={intl.formatMessage(messages.title)}>
        <div className='scrollable about'>
          <div className='about__header'>
            <ServerHeroImage blurhash={server.getIn(['thumbnail', 'blurhash'])} src={server.getIn(['thumbnail', 'url'])} srcSet={server.getIn(['thumbnail', 'versions'])?.map((value, key) => `${value} ${key.replace('@', '')}`).join(', ')} className='about__header__hero' />
            <h1>{isLoading ? <Skeleton width='10ch' /> : server.get('domain')}</h1>
            <p><FormattedMessage id='about.powered_by' defaultMessage='Decentralized social media powered by {mastodon}' values={{ mastodon: <a href='https://joinmastodon.org' className='about__mail' target='_blank'>Mastodon</a> }} /></p>
          </div>

          <div className='about__meta'>
            <div className='about__meta__column'>
              <h4><FormattedMessage id='server_banner.administered_by' defaultMessage='Administered by:' /></h4>

              <Account id={server.getIn(['contact', 'account', 'id'])} size={36} minimal />
            </div>

            <hr className='about__meta__divider' />

            <div className='about__meta__column'>
              <h4><FormattedMessage id='about.contact' defaultMessage='Contact:' /></h4>

              {isLoading ? <Skeleton width='10ch' /> : <a className='about__mail' href={emailLink}>{server.getIn(['contact', 'email'])}</a>}
            </div>
          </div>

          <Section open title={intl.formatMessage(messages.title)}>
            {extendedDescription.get('isLoading') ? (
              <>
                <Skeleton width='100%' />
                <br />
                <Skeleton width='100%' />
                <br />
                <Skeleton width='100%' />
                <br />
                <Skeleton width='70%' />
              </>
            ) : (extendedDescription.get('content')?.length > 0 ? (
              <div
                className='prose'
                dangerouslySetInnerHTML={{ __html: extendedDescription.get('content') }}
              />
            ) : (
              <p><FormattedMessage id='about.not_available' defaultMessage='This information has not been made available on this server.' /></p>
            ))}
          </Section>

          <Section title={intl.formatMessage(messages.rules)}>
            {!isLoading && (server.get('rules', ImmutableList()).isEmpty() ? (
              <p><FormattedMessage id='about.not_available' defaultMessage='This information has not been made available on this server.' /></p>
            ) : (
              <ol className='rules-list'>
                {server.get('rules').map(rule => (
                  <li key={rule.get('id')}>
                    <div className='rules-list__text'>{rule.get('text')}</div>
                    {rule.get('hint').length > 0 && (<div className='rules-list__hint'>{rule.get('hint')}</div>)}
                  </li>
                ))}
              </ol>
            ))}
          </Section>

          <Section title={intl.formatMessage(messages.capabilities)}>
            <p><FormattedMessage id='about.kmyblue_capability' defaultMessage='This server is using kmyblue, a fork of Mastodon. On this server, kmyblues unique features are configured as follows.' /></p>
            {!isLoading && (
              <ol className='rules-list'>
                <li>
                  <span className='rules-list__text'>{intl.formatMessage(messages.emojiReaction)}: <CapabilityIcon state={isEmojiReaction} intl={intl} /></span>
                </li>
                <li>
                  <span className='rules-list__text'>{intl.formatMessage(messages.publicVisibility)}: <CapabilityIcon state={isPublicVisibility} intl={intl} /></span>
                </li>
                <li>
                  <span className='rules-list__text'>{intl.formatMessage(messages.publicUnlistedVisibility)}: <CapabilityIcon state={isPublicUnlistedVisibility} intl={intl} /></span>
                </li>
                <li>
                  <span className='rules-list__text'>{intl.formatMessage(messages.localTimeline)}: <CapabilityIcon state={isLocalTimeline} intl={intl} /></span>
                </li>
                <li>
                  <span className='rules-list__text'>{intl.formatMessage(messages.fullTextSearch)}: <CapabilityIcon state={isFullTextSearch} intl={intl} /></span>
                </li>
              </ol>
            )}
          </Section>

          <Section title={intl.formatMessage(messages.blocks)} onOpen={this.handleDomainBlocksOpen}>
            {domainBlocks.get('isLoading') ? (
              <>
                <Skeleton width='100%' />
                <br />
                <Skeleton width='70%' />
              </>
            ) : (domainBlocks.get('isAvailable') ? (
              <>
                <p><FormattedMessage id='about.domain_blocks.preamble' defaultMessage='Mastodon generally allows you to view content from and interact with users from any other server in the fediverse. These are the exceptions that have been made on this particular server.' /></p>

                <div className='about__domain-blocks'>
                  {domainBlocks.get('items').map(block => (
                    <div className='about__domain-blocks__domain' key={block.get('domain')}>
                      <div className='about__domain-blocks__domain__header'>
                        <h6><span title={`SHA-256: ${block.get('digest')}`}>{block.get('domain')}</span></h6>
                        <span className='about__domain-blocks__domain__type' title={intl.formatMessage(severityMessages[block.get('severity')].explanation)}>{intl.formatMessage(severityMessages[block.get('severity_ex') || block.get('severity')].title)}</span>
                      </div>

                      <p>{(block.get('comment') || '').length > 0 ? block.get('comment') : <FormattedMessage id='about.domain_blocks.no_reason_available' defaultMessage='Reason not available' />}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p><FormattedMessage id='about.not_available' defaultMessage='This information has not been made available on this server.' /></p>
            ))}
          </Section>

          <LinkFooter />

          <div className='about__footer'>
            <p><FormattedMessage id='about.disclaimer' defaultMessage='Mastodon is free, open-source software, and a trademark of Mastodon gGmbH.' /></p>
          </div>
        </div>

        <Helmet>
          <title>{intl.formatMessage(messages.title)}</title>
          <meta name='robots' content='all' />
        </Helmet>
      </Column>
    );
  }

}

export default connect(mapStateToProps)(injectIntl(About));
