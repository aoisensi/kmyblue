# frozen_string_literal: true

# Reverted this commit.temporarily because load issues.
# Whenever a manual merge occurs, be sure to check the following commits.
# Hash: ee8d0b94473df357677cd1f82581251ce0423c01
# Message: Fix follow suggestions potentially including silenced or blocked accounts (#29306)

class AccountSuggestions::SimilarProfilesSource < AccountSuggestions::Source
  class QueryBuilder < AccountSearchService::QueryBuilder
    def must_clauses
      [
        {
          more_like_this: {
            fields: %w(text text.stemmed),
            like: @query.map { |id| { _index: 'accounts', _id: id } },
          },
        },

        {
          term: {
            properties: 'discoverable',
          },
        },
      ]
    end

    def must_not_clauses
      [
        {
          terms: {
            id: following_ids,
          },
        },

        {
          term: {
            properties: 'bot',
          },
        },
      ]
    end

    def should_clauses
      {
        term: {
          properties: {
            value: 'verified',
            boost: 2,
          },
        },
      }
    end
  end

  def get(account, limit: DEFAULT_LIMIT)
    recently_followed_account_ids = account.active_relationships.recent.limit(5).pluck(:target_account_id)

    if Chewy.enabled? && !recently_followed_account_ids.empty?
      QueryBuilder.new(recently_followed_account_ids, account).build.limit(limit).hits.pluck('_id').map(&:to_i).zip([key].cycle)
    else
      []
    end
  rescue Faraday::ConnectionFailed
    []
  end

  private

  def key
    :similar_to_recently_followed
  end
end
