# frozen_string_literal: true

require 'rails_helper'

RSpec.describe BackupService, type: :service do
  subject(:service_call) { described_class.new.call(backup) }

  let!(:user)           { Fabricate(:user) }
  let!(:attachment)     { Fabricate(:media_attachment, account: user.account) }
  let!(:status)         { Fabricate(:status, account: user.account, text: 'Hello', visibility: :public, media_attachments: [attachment]) }
  let!(:private_status) { Fabricate(:status, account: user.account, text: 'secret', visibility: :private) }
  let!(:limited_status) { Fabricate(:status, account: user.account, text: 'sec mutual', visibility: :limited, limited_scope: :mutual) }
  let!(:reblog_status)  { Fabricate(:status, account: user.account, reblog_of_id: Fabricate(:status).id) }
  let!(:favourite)      { Fabricate(:favourite, account: user.account) }
  let!(:bookmark)       { Fabricate(:bookmark, account: user.account) }
  let!(:backup)         { Fabricate(:backup, user: user) }

  def read_zip_file(backup, filename)
    file = Paperclip.io_adapters.for(backup.dump)
    Zip::File.open(file) do |zipfile|
      entry = zipfile.glob(filename).first
      return entry.get_input_stream.read
    end
  end

  context 'when the user has an avatar and header' do
    before do
      user.account.update!(avatar: attachment_fixture('avatar.gif'))
      user.account.update!(header: attachment_fixture('emojo.png'))
    end

    it 'stores them as expected' do
      service_call

      json = export_json(:actor)
      avatar_path = json.dig('icon', 'url')
      header_path = json.dig('image', 'url')

      expect(avatar_path).to_not be_nil
      expect(header_path).to_not be_nil

      expect(read_zip_file(backup, avatar_path)).to be_present
      expect(read_zip_file(backup, header_path)).to be_present
    end
  end

  it 'marks the backup as processed and exports files' do
    expect { service_call }.to process_backup

    expect_outbox_export
    expect_likes_export
    expect_bookmarks_export
  end

  def process_backup
    change(backup, :processed).from(false).to(true)
  end

  def expect_outbox_export
    json = export_json(:outbox)

    aggregate_failures do
      expect(json['@context']).to_not be_nil
      expect(json['type']).to eq 'OrderedCollection'
      expect(json['totalItems']).to eq 4
      expect(json['orderedItems'][0]['@context']).to be_nil
      expect(json['orderedItems'][0]).to include_create_item(status)
      expect(json['orderedItems'][1]).to include_create_item(private_status)
      expect(json['orderedItems'][2]).to include_create_item(limited_status)
      expect(json['orderedItems'][3]).to include_announce_item(reblog_status)
    end
  end

  def expect_likes_export
    json = export_json(:likes)

    aggregate_failures do
      expect(json['type']).to eq 'OrderedCollection'
      expect(json['orderedItems']).to eq [ActivityPub::TagManager.instance.uri_for(favourite.status)]
    end
  end

  def expect_bookmarks_export
    json = export_json(:bookmarks)

    aggregate_failures do
      expect(json['type']).to eq 'OrderedCollection'
      expect(json['orderedItems']).to eq [ActivityPub::TagManager.instance.uri_for(bookmark.status)]
    end
  end

  def export_json(type)
    Oj.load(read_zip_file(backup, "#{type}.json"))
  end

  def include_create_item(status)
    include({
      'type' => 'Create',
      'object' => include({
        'id' => ActivityPub::TagManager.instance.uri_for(status),
        'content' => "<p>#{status.text}</p>",
      }),
    })
  end

  def include_announce_item(status)
    include({
      'type' => 'Announce',
      'object' => ActivityPub::TagManager.instance.uri_for(status.reblog),
    })
  end
end
