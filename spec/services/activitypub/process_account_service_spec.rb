# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ActivityPub::ProcessAccountService, type: :service do
  subject { described_class.new }

  before do
    stub_request(:get, 'https://example.com/.well-known/nodeinfo').to_return(status: 404)
  end

  describe 'about blocking new remote account' do
    subject { described_class.new.call('alice', 'example.com', payload) }

    let(:hold_remote_new_accounts) { true }
    let(:permit_new_account_domains) { nil }
    let(:payload) do
      {
        id: 'https://foo.test',
        type: 'Actor',
        inbox: 'https://foo.test/inbox',
        actor_type: 'Person',
        summary: 'new bio',
      }.with_indifferent_access
    end

    before do
      Setting.hold_remote_new_accounts = hold_remote_new_accounts
      Setting.permit_new_account_domains = permit_new_account_domains
    end

    it 'creates pending account in a simple case' do
      expect(subject).to_not be_nil
      expect(subject.uri).to eq 'https://foo.test'
      expect(subject.suspended?).to be true
      expect(subject.remote_pending).to be true
    end

    context 'when is blocked' do
      let(:permit_new_account_domains) { ['foo.bar'] }

      it 'creates pending account' do
        expect(subject).to_not be_nil
        expect(subject.suspended?).to be true
        expect(subject.remote_pending).to be true
      end

      context 'when the domain is not on list but hold_remote_new_accounts is disabled' do
        let(:hold_remote_new_accounts) { false }

        it 'creates normal account' do
          expect(subject).to_not be_nil
          expect(subject.suspended?).to be false
          expect(subject.remote_pending).to be false
        end
      end

      context 'with has existing account' do
        before do
          Fabricate(:account, uri: 'https://foo.test', domain: 'example.com', username: 'alice', note: 'old bio')
        end

        it 'updated account' do
          expect(subject).to_not be_nil
          expect(subject.suspended?).to be false
          expect(subject.remote_pending).to be false
          expect(subject.note).to eq 'new bio'
        end
      end

      context 'with has existing suspended pending account' do
        before do
          Fabricate(:account, uri: 'https://foo.test', domain: 'example.com', username: 'alice', note: 'old bio', suspended_at: 1.day.ago, remote_pending: true, suspension_origin: :local)
        end

        it 'updated account' do
          expect(subject).to_not be_nil
          expect(subject.suspended?).to be true
          expect(subject.remote_pending).to be true
          expect(subject.suspension_origin_local?).to be true
          expect(subject.note).to eq 'new bio'
        end
      end

      context 'with has existing suspended account' do
        before do
          Fabricate(:account, uri: 'https://foo.test', domain: 'example.com', username: 'alice', note: 'old bio', suspended_at: 1.day.ago, suspension_origin: :local)
        end

        it 'does not update account' do
          expect(subject).to_not be_nil
          expect(subject.suspended?).to be true
          expect(subject.remote_pending).to be false
          expect(subject.suspension_origin_local?).to be true
          expect(subject.note).to eq 'old bio'
        end
      end
    end

    context 'when is in whitelist' do
      let(:permit_new_account_domains) { ['example.com'] }

      it 'does not create account' do
        expect(subject).to_not be_nil
        expect(subject.uri).to eq 'https://foo.test'
        expect(subject.suspended?).to be false
        expect(subject.remote_pending).to be false
      end
    end
  end

  context 'with searchability' do
    subject { described_class.new.call('alice', 'example.com', payload) }

    let(:software) { 'mastodon' }
    let(:searchable_by) { 'https://www.w3.org/ns/activitystreams#Public' }
    let(:sender_bio) { '' }
    let(:indexable) { nil }
    let(:payload) do
      {
        id: 'https://foo.test',
        type: 'Actor',
        inbox: 'https://foo.test/inbox',
        followers: 'https://example.com/followers',
        searchableBy: searchable_by,
        indexable: indexable,
        summary: sender_bio,
        actor_type: 'Person',
      }.with_indifferent_access
    end

    before do
      Fabricate(:instance_info, domain: 'example.com', software: software)
      stub_request(:get, 'https://example.com/.well-known/nodeinfo').to_return(body: '{}')
      stub_request(:get, 'https://example.com/followers').to_return(body: '[]')
    end

    context 'when public' do
      it 'searchability is public' do
        expect(subject.searchability).to eq 'public'
      end
    end

    context 'when private' do
      let(:searchable_by) { 'https://example.com/followers' }

      it 'searchability is private' do
        expect(subject.searchability).to eq 'private'
      end
    end

    context 'when direct' do
      let(:searchable_by) { '' }

      it 'searchability is direct' do
        expect(subject.searchability).to eq 'direct'
      end
    end

    context 'when limited' do
      let(:searchable_by) { 'kmyblue:Limited' }

      it 'searchability is limited' do
        expect(subject.searchability).to eq 'limited'
      end
    end

    context 'when limited old spec' do
      let(:searchable_by) { 'as:Limited' }

      it 'searchability is limited' do
        expect(subject.searchability).to eq 'limited'
      end
    end

    context 'when default value' do
      let(:searchable_by) { nil }

      it 'searchability is direct' do
        expect(subject.searchability).to eq 'direct'
      end
    end

    context 'when misskey user' do
      let(:software) { 'misskey' }
      let(:searchable_by) { nil }

      it 'searchability is public' do
        expect(subject.searchability).to eq 'public'
      end

      context 'with true indexable' do
        let(:indexable) { true }

        it 'searchability is public' do
          expect(subject.searchability).to eq 'public'
        end
      end

      context 'with false indexable' do
        let(:indexable) { false }

        it 'searchability is limited' do
          expect(subject.searchability).to eq 'limited'
        end
      end

      context 'with no-indexable key' do
        let(:payload) do
          {
            id: 'https://foo.test',
            type: 'Actor',
            inbox: 'https://foo.test/inbox',
            followers: 'https://example.com/followers',
            searchableBy: searchable_by,
            summary: sender_bio,
          }.with_indifferent_access
        end

        it 'searchability is public' do
          expect(subject.searchability).to eq 'public'
        end
      end
    end

    context 'with bio' do
      let(:searchable_by) { nil }

      context 'with public' do
        let(:sender_bio) { '#searchable_by_all_users' }

        it 'searchability is public' do
          expect(subject.searchability).to eq 'public'
        end
      end

      context 'with private' do
        let(:sender_bio) { '#searchable_by_followers_only' }

        it 'searchability is private' do
          expect(subject.searchability).to eq 'private'
        end
      end

      context 'with direct' do
        let(:sender_bio) { '#searchable_by_reacted_users_only' }

        it 'searchability is direct' do
          expect(subject.searchability).to eq 'direct'
        end
      end

      context 'with limited' do
        let(:sender_bio) { '#searchable_by_nobody' }

        it 'searchability is limited' do
          expect(subject.searchability).to eq 'limited'
        end
      end
    end
  end

  context 'with subscription policy' do
    subject { described_class.new.call('alice', 'example.com', payload) }

    let(:subscribable_by) { 'https://www.w3.org/ns/activitystreams#Public' }
    let(:sender_bio) { '' }
    let(:payload) do
      {
        id: 'https://foo.test',
        type: 'Actor',
        inbox: 'https://foo.test/inbox',
        followers: 'https://example.com/followers',
        subscribableBy: subscribable_by,
        summary: sender_bio,
        actor_type: 'Person',
      }.with_indifferent_access
    end

    before do
      stub_request(:get, 'https://example.com/.well-known/nodeinfo').to_return(body: '{}')
      stub_request(:get, 'https://example.com/followers').to_return(body: '[]')
    end

    context 'when public' do
      it 'subscription policy is allow' do
        expect(subject.subscription_policy.to_s).to eq 'allow'
      end
    end

    context 'when private' do
      let(:subscribable_by) { 'https://example.com/followers' }

      it 'subscription policy is followers_only' do
        expect(subject.subscription_policy.to_s).to eq 'followers_only'
      end
    end

    context 'when empty' do
      let(:subscribable_by) { '' }

      it 'subscription policy is block' do
        expect(subject.subscription_policy.to_s).to eq 'block'
      end
    end

    context 'when default value' do
      let(:subscribable_by) { nil }

      it 'subscription policy is allow' do
        expect(subject.subscription_policy.to_s).to eq 'allow'
      end
    end

    context 'with bio' do
      let(:subscribable_by) { nil }

      context 'with no-subscribe' do
        let(:sender_bio) { '[subscribable:no]' }

        it 'subscription policy is block' do
          expect(subject.subscription_policy.to_s).to eq 'block'
        end
      end
    end
  end

  context 'with property values, an avatar, and a profile header' do
    let(:payload) do
      {
        id: 'https://foo.test',
        type: 'Actor',
        inbox: 'https://foo.test/inbox',
        attachment: [
          { type: 'PropertyValue', name: 'Pronouns', value: 'They/them' },
          { type: 'PropertyValue', name: 'Occupation', value: 'Unit test' },
          { type: 'PropertyValue', name: 'non-string', value: %w(foo bar) },
        ],
        image: {
          type: 'Image',
          mediaType: 'image/png',
          url: 'https://foo.test/image.png',
        },
        icon: {
          type: 'Image',
          url: [
            {
              mediaType: 'image/png',
              href: 'https://foo.test/icon.png',
            },
          ],
        },
      }.with_indifferent_access
    end

    before do
      stub_request(:get, 'https://example.com/.well-known/nodeinfo').to_return(body: '{}')
      stub_request(:get, 'https://foo.test/image.png').to_return(request_fixture('avatar.txt'))
      stub_request(:get, 'https://foo.test/icon.png').to_return(request_fixture('avatar.txt'))
    end

    it 'parses property values, avatar and profile header as expected' do
      account = subject.call('alice', 'example.com', payload)

      expect(account.fields)
        .to be_an(Array)
        .and have_attributes(size: 2)
      expect(account.fields.first)
        .to be_an(Account::Field)
        .and have_attributes(
          name: eq('Pronouns'),
          value: eq('They/them')
        )
      expect(account.fields.last)
        .to be_an(Account::Field)
        .and have_attributes(
          name: eq('Occupation'),
          value: eq('Unit test')
        )
      expect(account).to have_attributes(
        avatar_remote_url: 'https://foo.test/icon.png',
        header_remote_url: 'https://foo.test/image.png'
      )
    end
  end

  context 'with other settings' do
    let(:payload) do
      {
        id: 'https://foo.test',
        type: 'Actor',
        inbox: 'https://foo.test/inbox',
        otherSetting: [
          { type: 'PropertyValue', name: 'Pronouns', value: 'They/them' },
          { type: 'PropertyValue', name: 'Occupation', value: 'Unit test' },
        ],
      }.with_indifferent_access
    end

    before do
      stub_request(:get, 'https://example.com/.well-known/nodeinfo').to_return(body: '{}')
    end

    it 'parses out of attachment' do
      account = subject.call('alice', 'example.com', payload)
      expect(account.settings).to be_a Hash
      expect(account.settings.size).to eq 2
      expect(account.settings['Pronouns']).to eq 'They/them'
      expect(account.settings['Occupation']).to eq 'Unit test'
    end
  end

  context 'when account is using note contains ng words' do
    subject { described_class.new.call(account.username, account.domain, payload) }

    let!(:account) { Fabricate(:account, username: 'alice', domain: 'example.com') }

    let(:payload) do
      {
        id: 'https://foo.test',
        type: 'Actor',
        inbox: 'https://foo.test/inbox',
        name: 'Ohagi',
      }.with_indifferent_access
    end

    it 'creates account when ng word is not set' do
      Setting.ng_words = ['Amazon']
      subject
      expect(account.reload.display_name).to eq 'Ohagi'

      history = NgwordHistory.find_by(uri: payload[:id])
      expect(history).to be_nil
    end

    it 'does not create account when ng word is set' do
      Setting.ng_words = ['Ohagi']
      subject
      expect(account.reload.display_name).to_not eq 'Ohagi'

      history = NgwordHistory.find_by(uri: payload[:id])
      expect(history).to_not be_nil
      expect(history.account_name_blocked?).to be true
      expect(history.within_ng_words?).to be true
      expect(history.keyword).to eq 'Ohagi'
    end
  end

  context 'when account is not suspended' do
    subject { described_class.new.call(account.username, account.domain, payload) }

    let!(:account) { Fabricate(:account, username: 'alice', domain: 'example.com') }

    let(:payload) do
      {
        id: 'https://foo.test',
        type: 'Actor',
        inbox: 'https://foo.test/inbox',
        suspended: true,
      }.with_indifferent_access
    end

    before do
      allow(Admin::SuspensionWorker).to receive(:perform_async)
    end

    it 'suspends account remotely' do
      expect(subject.suspended?).to be true
      expect(subject.suspension_origin_remote?).to be true
    end

    it 'queues suspension worker' do
      subject
      expect(Admin::SuspensionWorker).to have_received(:perform_async)
    end
  end

  context 'when account is suspended' do
    subject { described_class.new.call('alice', 'example.com', payload) }

    let!(:account) { Fabricate(:account, username: 'alice', domain: 'example.com', display_name: '') }

    let(:payload) do
      {
        id: 'https://foo.test',
        type: 'Actor',
        inbox: 'https://foo.test/inbox',
        suspended: false,
        name: 'Hoge',
      }.with_indifferent_access
    end

    before do
      allow(Admin::UnsuspensionWorker).to receive(:perform_async)

      account.suspend!(origin: suspension_origin)
    end

    context 'when locally' do
      let(:suspension_origin) { :local }

      it 'does not unsuspend it' do
        expect(subject.suspended?).to be true
      end

      it 'does not update any attributes' do
        expect(subject.display_name).to_not eq 'Hoge'
      end
    end

    context 'when remotely' do
      let(:suspension_origin) { :remote }

      it 'unsuspends it' do
        expect(subject.suspended?).to be false
      end

      it 'queues unsuspension worker' do
        subject
        expect(Admin::UnsuspensionWorker).to have_received(:perform_async)
      end

      it 'updates attributes' do
        expect(subject.display_name).to eq 'Hoge'
      end
    end
  end

  context 'when discovering many subdomains in a short timeframe' do
    subject do
      8.times do |i|
        domain = "test#{i}.testdomain.com"
        json = {
          id: "https://#{domain}/users/1",
          type: 'Actor',
          inbox: "https://#{domain}/inbox",
        }.with_indifferent_access
        described_class.new.call('alice', domain, json)
      end
    end

    before do
      stub_const 'ActivityPub::ProcessAccountService::SUBDOMAINS_RATELIMIT', 5
      8.times do |i|
        stub_request(:get, "https://test#{i}.testdomain.com/.well-known/nodeinfo").to_return(body: '{}')
      end
    end

    it 'creates accounts without exceeding rate limit' do
      expect { subject }
        .to create_some_remote_accounts
        .and create_fewer_than_rate_limit_accounts
    end
  end

  context 'when Accounts referencing other accounts' do
    let(:payload) do
      {
        '@context': ['https://www.w3.org/ns/activitystreams'],
        id: 'https://foo.test/users/1',
        type: 'Person',
        inbox: 'https://foo.test/inbox',
        featured: 'https://foo.test/users/1/featured',
        preferredUsername: 'user1',
      }.with_indifferent_access
    end

    before do
      stub_const 'ActivityPub::ProcessAccountService::DISCOVERIES_PER_REQUEST', 5

      8.times do |i|
        actor_json = {
          '@context': ['https://www.w3.org/ns/activitystreams'],
          id: "https://foo.test/users/#{i}",
          type: 'Person',
          inbox: 'https://foo.test/inbox',
          featured: "https://foo.test/users/#{i}/featured",
          preferredUsername: "user#{i}",
        }.with_indifferent_access
        status_json = {
          '@context': ['https://www.w3.org/ns/activitystreams'],
          id: "https://foo.test/users/#{i}/status",
          attributedTo: "https://foo.test/users/#{i}",
          type: 'Note',
          content: "@user#{i + 1} test",
          tag: [
            {
              type: 'Mention',
              href: "https://foo.test/users/#{i + 1}",
              name: "@user#{i + 1}",
            },
          ],
          to: ['as:Public', "https://foo.test/users/#{i + 1}"],
        }.with_indifferent_access
        featured_json = {
          '@context': ['https://www.w3.org/ns/activitystreams'],
          id: "https://foo.test/users/#{i}/featured",
          type: 'OrderedCollection',
          totalItems: 1,
          orderedItems: [status_json],
        }.with_indifferent_access
        webfinger = {
          subject: "acct:user#{i}@foo.test",
          links: [{ rel: 'self', href: "https://foo.test/users/#{i}" }],
        }.with_indifferent_access
        stub_request(:get, "https://foo.test/users/#{i}").to_return(status: 200, body: actor_json.to_json, headers: { 'Content-Type': 'application/activity+json' })
        stub_request(:get, "https://foo.test/users/#{i}/featured").to_return(status: 200, body: featured_json.to_json, headers: { 'Content-Type': 'application/activity+json' })
        stub_request(:get, "https://foo.test/users/#{i}/status").to_return(status: 200, body: status_json.to_json, headers: { 'Content-Type': 'application/activity+json' })
        stub_request(:get, "https://foo.test/.well-known/webfinger?resource=acct:user#{i}@foo.test").to_return(body: webfinger.to_json, headers: { 'Content-Type': 'application/jrd+json' })
        stub_request(:get, 'https://foo.test/.well-known/nodeinfo').to_return(body: '{}')
      end
    end

    it 'creates accounts without exceeding rate limit', :sidekiq_inline do
      expect { subject.call('user1', 'foo.test', payload) }
        .to create_some_remote_accounts
        .and create_fewer_than_rate_limit_accounts
    end
  end

  private

  def create_some_remote_accounts
    change(Account.remote, :count).by_at_least(2)
  end

  def create_fewer_than_rate_limit_accounts
    change(Account.remote, :count).by_at_most(5)
  end
end
